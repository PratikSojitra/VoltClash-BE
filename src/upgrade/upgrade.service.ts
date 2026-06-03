import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameDataService } from '../game-data/game-data.service';
import { StartUpgradeDto } from './dto/start-upgrade.dto';

@Injectable()
export class UpgradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameDataService: GameDataService,
  ) {}

  async startUpgrade(userId: string, dto: StartUpgradeDto) {
    const formattedTag = dto.playerTag.toUpperCase().trim();

    // 1. Verify ownership
    const account = await this.prisma.playerAccount.findFirst({
      where: { player_tag: formattedTag, user_id: userId },
    });
    if (!account) {
      throw new NotFoundException(`Player tag ${formattedTag} not associated with this user`);
    }

    // 2. Fetch upgrade time & cost
    const targetLevel = dto.currentLevel + 1;
    const upgradeDetails = this.gameDataService.getBuildingUpgrade(dto.itemName, targetLevel);

    // 3. Find an available builder slot
    const availableSlot = await this.prisma.builderSlot.findFirst({
      where: { player_tag: formattedTag, is_busy: false },
      orderBy: { slot_number: 'asc' },
    });

    if (!availableSlot) {
      throw new ConflictException(
        'All builders are currently busy! Complete or cancel an upgrade first.',
      );
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + upgradeDetails.durationSeconds * 1000);

    // 4. Update slot and create timer in transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.builderSlot.update({
        where: { id: availableSlot.id },
        data: {
          is_busy: true,
          available_at: endTime,
        },
      });

      return tx.upgradeTimer.create({
        data: {
          player_tag: formattedTag,
          item_name: dto.itemName,
          current_level: dto.currentLevel,
          target_level: targetLevel,
          start_time: startTime,
          end_time: endTime,
          builder_slot: availableSlot.slot_number,
          status: 'ACTIVE',
        },
      });
    });
  }

  async completeUpgrade(userId: string, upgradeId: string) {
    const timer = await this.prisma.upgradeTimer.findUnique({
      where: { id: upgradeId },
      include: { player_account: true },
    });

    if (!timer || timer.status !== 'ACTIVE') {
      throw new NotFoundException('Active upgrade timer not found');
    }

    if (timer.player_account.user_id !== userId) {
      throw new UnauthorizedException('Access denied');
    }

    return this.prisma.$transaction(async (tx) => {
      // Free builder slot
      await tx.builderSlot.update({
        where: {
          player_tag_slot_number: {
            player_tag: timer.player_tag,
            slot_number: timer.builder_slot,
          },
        },
        data: {
          is_busy: false,
          available_at: null,
        },
      });

      // Mark timer as completed
      await tx.upgradeTimer.update({
        where: { id: upgradeId },
        data: { status: 'COMPLETED' },
      });

      // Increment building level in database
      return tx.building.upsert({
        where: {
          player_tag_name: {
            player_tag: timer.player_tag,
            name: timer.item_name,
          },
        },
        create: {
          player_tag: timer.player_tag,
          name: timer.item_name,
          level: timer.target_level,
          village: 'home',
        },
        update: {
          level: timer.target_level,
        },
      });
    });
  }

  async cancelUpgrade(userId: string, upgradeId: string) {
    const timer = await this.prisma.upgradeTimer.findUnique({
      where: { id: upgradeId },
      include: { player_account: true },
    });

    if (!timer || timer.status !== 'ACTIVE') {
      throw new NotFoundException('Active upgrade timer not found');
    }

    if (timer.player_account.user_id !== userId) {
      throw new UnauthorizedException('Access denied');
    }

    return this.prisma.$transaction(async (tx) => {
      // Free builder slot
      await tx.builderSlot.update({
        where: {
          player_tag_slot_number: {
            player_tag: timer.player_tag,
            slot_number: timer.builder_slot,
          },
        },
        data: {
          is_busy: false,
          available_at: null,
        },
      });

      // Mark timer as cancelled
      return tx.upgradeTimer.update({
        where: { id: upgradeId },
        data: { status: 'CANCELLED' },
      });
    });
  }

  async applyBuilderPotionBoost(userId: string, playerTag: string) {
    const formattedTag = playerTag.toUpperCase().trim();
    const account = await this.prisma.playerAccount.findFirst({
      where: { player_tag: formattedTag, user_id: userId },
    });
    if (!account) {
      throw new NotFoundException(`Player tag ${formattedTag} not associated with this user`);
    }

    const activeTimers = await this.prisma.upgradeTimer.findMany({
      where: { player_tag: formattedTag, status: 'ACTIVE' },
    });

    if (activeTimers.length === 0) {
      return { message: 'No active upgrades to speed up!' };
    }

    // Builder potion speeds up by 10x for 1 hour. Net time saved = 9 hours (32,400,000 milliseconds)
    const nineHoursInMs = 9 * 3600 * 1000;

    await this.prisma.$transaction(async (tx) => {
      for (const timer of activeTimers) {
        const newEndTime = new Date(
          Math.max(Date.now(), timer.end_time.getTime() - nineHoursInMs),
        );

        await tx.upgradeTimer.update({
          where: { id: timer.id },
          data: { end_time: newEndTime },
        });

        await tx.builderSlot.update({
          where: {
            player_tag_slot_number: {
              player_tag: timer.player_tag,
              slot_number: timer.builder_slot,
            },
          },
          data: { available_at: newEndTime },
        });
      }
    });

    return { message: 'Successfully applied Builder Potion boost (reduced durations by 9 hours)' };
  }
}
