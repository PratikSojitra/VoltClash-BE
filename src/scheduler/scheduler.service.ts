import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async autoCompleteUpgrades() {
    const now = new Date();

    // Fetch active upgrades that have reached their target endTime
    const expiredTimers = await this.prisma.upgradeTimer.findMany({
      where: {
        status: 'ACTIVE',
        end_time: { lte: now },
      },
    });

    if (expiredTimers.length === 0) {
      return;
    }

    this.logger.log(
      `Background scheduler found ${expiredTimers.length} upgrades to auto-complete`,
    );

    for (const timer of expiredTimers) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // 1. Free the corresponding player's builder slot
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

          // 2. Mark the active timer as completed
          await tx.upgradeTimer.update({
            where: { id: timer.id },
            data: { status: 'COMPLETED' },
          });

          // 3. Save the upgraded building level in the player profile
          await tx.building.upsert({
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

        this.logger.log(
          `Auto-completed upgrade: ${timer.item_name} -> Level ${timer.target_level} for player ${timer.player_tag}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to auto-complete upgrade timer ${timer.id} for player ${timer.player_tag}`,
          error.stack,
        );
      }
    }
  }
}
