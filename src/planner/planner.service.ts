import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameDataService } from '../game-data/game-data.service';
import { AddPlanDto } from './dto/add-plan.dto';
import { CalculateQueueDto } from './dto/calculate-queue.dto';

@Injectable()
export class PlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameDataService: GameDataService,
  ) {}

  async addUpgradePlan(userId: string, dto: AddPlanDto) {
    const formattedTag = dto.playerTag.toUpperCase().trim();

    // 1. Verify ownership
    const account = await this.prisma.playerAccount.findFirst({
      where: { player_tag: formattedTag, user_id: userId },
    });
    if (!account) {
      throw new NotFoundException(`Player tag ${formattedTag} not associated with this user`);
    }

    if (dto.fromLevel >= dto.toLevel) {
      throw new BadRequestException('Target level must be greater than starting level');
    }

    // 2. Loop and sum cost and time across levels in range
    let totalCost = 0;
    let totalTimeSeconds = 0;

    for (let lvl = dto.fromLevel + 1; lvl <= dto.toLevel; lvl++) {
      const details = this.gameDataService.getBuildingUpgrade(dto.itemName, lvl);
      totalCost += details.cost;
      totalTimeSeconds += details.durationSeconds;
    }

    // 3. Save the plan
    return this.prisma.upgradePlanner.create({
      data: {
        player_tag: formattedTag,
        item_name: dto.itemName,
        from_level: dto.fromLevel,
        to_level: dto.toLevel,
        cost: totalCost,
        time_required: totalTimeSeconds,
        priority: dto.priority || 0,
      },
    });
  }

  async listUpgradePlans(userId: string, playerTag: string) {
    const formattedTag = playerTag.toUpperCase().trim();
    const account = await this.prisma.playerAccount.findFirst({
      where: { player_tag: formattedTag, user_id: userId },
    });
    if (!account) {
      throw new NotFoundException(`Player tag ${formattedTag} not associated with this user`);
    }

    return this.prisma.upgradePlanner.findMany({
      where: { player_tag: formattedTag },
      orderBy: [
        { priority: 'desc' },
      ],
    });
  }

  async deleteUpgradePlan(userId: string, planId: string) {
    const plan = await this.prisma.upgradePlanner.findUnique({
      where: { id: planId },
      include: { player_account: true },
    });

    if (!plan) {
      throw new NotFoundException('Upgrade plan not found');
    }

    if (plan.player_account.user_id !== userId) {
      throw new UnauthorizedException('Access denied');
    }

    await this.prisma.upgradePlanner.delete({
      where: { id: planId },
    });

    return { message: 'Plan item successfully removed' };
  }

  async updatePlanPriority(userId: string, planId: string, priority: number) {
    const plan = await this.prisma.upgradePlanner.findUnique({
      where: { id: planId },
      include: { player_account: true },
    });

    if (!plan) {
      throw new NotFoundException('Upgrade plan not found');
    }

    if (plan.player_account.user_id !== userId) {
      throw new UnauthorizedException('Access denied');
    }

    return this.prisma.upgradePlanner.update({
      where: { id: planId },
      data: { priority },
    });
  }

  // Pure Calculation Engine: calculate cost & duration for list of structures
  async calculateQueue(dto: CalculateQueueDto) {
    let totalGoldCost = 0;
    let totalElixirCost = 0;
    let totalTimeSeconds = 0;

    const breakDowns: any[] = [];

    for (const item of dto.items) {
      let itemGold = 0;
      let itemElixir = 0;
      let itemSeconds = 0;

      for (let lvl = item.fromLevel + 1; lvl <= item.toLevel; lvl++) {
        const details = this.gameDataService.getBuildingUpgrade(item.itemName, lvl);
        
        if (details.resourceType === 'Gold') {
          itemGold += details.cost;
        } else {
          itemElixir += details.cost;
        }
        itemSeconds += details.durationSeconds;
      }

      totalGoldCost += itemGold;
      totalElixirCost += itemElixir;
      totalTimeSeconds += itemSeconds;

      breakDowns.push({
        itemName: item.itemName,
        fromLevel: item.fromLevel,
        toLevel: item.toLevel,
        goldCost: itemGold,
        elixirCost: itemElixir,
        durationSeconds: itemSeconds,
      });
    }

    return {
      totals: {
        goldCost: totalGoldCost,
        elixirCost: totalElixirCost,
        durationSeconds: totalTimeSeconds,
        formattedTime: this.formatSeconds(totalTimeSeconds),
      },
      items: breakDowns,
    };
  }

  private formatSeconds(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);

    return parts.join(' ');
  }
}
