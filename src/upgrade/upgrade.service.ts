import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameDataService } from '../game-data/game-data.service';
import { StartUpgradeDto } from './dto/start-upgrade.dto';

const LAB_ITEMS = new Set([
  // Home troops
  'Barbarian', 'Archer', 'Giant', 'Goblin', 'Wall Breaker', 'Balloon', 'Wizard', 'Healer', 'Dragon', 'PEKKA', 'Baby Dragon', 'Miner', 'Electro Dragon', 'Yeti', 'Dragon Rider', 'Electro Titan', 'Root Rider', 'Druid', 'Minion', 'Hog Rider', 'Valkyrie', 'Golem', 'Witch', 'Lava Hound', 'Bowler', 'Headhunter',
  // Builder troops
  'Raged Barbarian', 'Sneaky Archer', 'Boxer Giant', 'Beta Minion', 'Bomber', 'Cannon Cart', 'Night Witch', 'Drop Ship', 'Power P.E.K.K.A', 'Hog Glider', 'Electrofire Wizard',
  // Spells
  'Lightning Spell', 'Healing Spell', 'Rage Spell', 'Jump Spell', 'Freeze Spell', 'Clone Spell', 'Invisibility Spell', 'Overgrowth Spell', 'Poison Spell', 'Earthquake Spell', 'Haste Spell', 'Skeleton Spell', 'Bat Spell', 'Recall Spell'
]);

const HERO_ITEMS = new Set([
  'Barbarian King', 'Archer Queen', 'Grand Warden', 'Royal Champion', 'Battle Machine', 'Battle Copter'
]);

const BUILDER_VILLAGE_ITEMS = new Set([
  'Double Cannon', 'Firecrackers', 'Crusher', 'Roaster', 'Giant Cannon', 'Mega Tesla', 'Lava Launcher', 'Guard Post',
  'Builder Barracks', 'Star Laboratory', 'Clock Tower',
  'Gem Mine', "O.T.T.O's Outpost",
  'Raged Barbarian', 'Sneaky Archer', 'Boxer Giant', 'Beta Minion', 'Bomber', 'Cannon Cart', 'Night Witch', 'Drop Ship', 'Power P.E.K.K.A', 'Hog Glider', 'Electrofire Wizard',
  'Battle Machine', 'Battle Copter',
  'Push Trap', 'Mine', 'Mega Mine'
]);

@Injectable()
export class UpgradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameDataService: GameDataService,
  ) {}

  private getItemCategory(name: string): 'Troops' | 'Spells' | 'Heroes' | 'Defenses' | 'Resources' | 'Army' | 'Traps' {
    if (LAB_ITEMS.has(name)) {
      return name.toLowerCase().includes('spell') ? 'Spells' : 'Troops';
    }
    if (HERO_ITEMS.has(name)) {
      return 'Heroes';
    }
    const traps = ['Bomb', 'Spring Trap', 'Giant Bomb', 'Air Bomb', 'Seeking Air Mine', 'Skeleton Trap', 'Tornado Trap', 'Mine', 'Mega Mine', 'Push Trap'];
    if (traps.includes(name)) {
      return 'Traps';
    }
    const army = ['Army Camp', 'Barracks', 'Dark Barracks', 'Laboratory', 'Spell Factory', 'Dark Spell Factory', 'Clan Castle', 'Pet House', 'Workshop', 'Blacksmith', 'Builder Barracks', 'Star Laboratory', 'Clock Tower'];
    if (army.includes(name)) {
      return 'Army';
    }
    const resources = ['Gold Mine', 'Elixir Collector', 'Dark Elixir Drill', 'Gold Storage', 'Elixir Storage', 'Dark Elixir Storage', 'Gem Mine', "O.T.T.O's Outpost"];
    if (resources.includes(name)) {
      return 'Resources';
    }
    return 'Defenses';
  }

  private getItemVillage(name: string, dtoVillage?: string): 'home' | 'builder' {
    if (dtoVillage === 'builder' || dtoVillage === 'home') {
      return dtoVillage;
    }
    if (BUILDER_VILLAGE_ITEMS.has(name)) {
      return 'builder';
    }
    return 'home';
  }

  async startUpgrade(userId: string, dto: StartUpgradeDto) {
    const formattedTag = dto.playerTag.toUpperCase().trim();
    const isLabItem = LAB_ITEMS.has(dto.itemName);
    const category = this.getItemCategory(dto.itemName);
    const village = this.getItemVillage(dto.itemName, dto.village);

    // 1. Verify ownership
    const account = await this.prisma.playerAccount.findFirst({
      where: { player_tag: formattedTag, user_id: userId },
    });
    if (!account) {
      throw new NotFoundException(`Player tag ${formattedTag} not associated with this user`);
    }

    // 2. Fetch upgrade details
    const targetLevel = dto.currentLevel + 1;
    const upgradeDetails = isLabItem
      ? this.gameDataService.getTroopUpgrade(dto.itemName, targetLevel)
      : this.gameDataService.getBuildingUpgrade(dto.itemName, targetLevel);

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + upgradeDetails.durationSeconds * 1000);

    // 3. For Lab items, ensure Lab is not busy
    if (isLabItem) {
      const activeLabUpgrade = await this.prisma.upgradeTimer.findFirst({
        where: {
          player_tag: formattedTag,
          status: 'ACTIVE',
          item_name: { in: Array.from(LAB_ITEMS) },
        },
      });

      if (activeLabUpgrade) {
        throw new ConflictException(
          'Your Laboratory is currently busy researching another item!',
        );
      }

      // Create Lab Upgrade Timer (builder_slot = 0 represents Laboratory slot)
      return this.prisma.upgradeTimer.create({
        data: {
          player_tag: formattedTag,
          item_name: dto.itemName,
          current_level: dto.currentLevel,
          target_level: targetLevel,
          start_time: startTime,
          end_time: endTime,
          builder_slot: 0,
          status: 'ACTIVE',
        },
      });
    }

    // 4. For builder items, find an available builder slot
    const maxBuildersCount = village === 'builder' ? 2 : 6;
    
    // Ensure all builder slots are initialized in DB for this player tag
    const existingSlots = await this.prisma.builderSlot.findMany({
      where: { player_tag: formattedTag },
    });

    if (existingSlots.length < maxBuildersCount) {
      const existingSlotNumbers = existingSlots.map(s => s.slot_number);
      const slotsToCreate = [] as any[];
      for (let i = 1; i <= maxBuildersCount; i++) {
        if (!existingSlotNumbers.includes(i)) {
          slotsToCreate.push({
            player_tag: formattedTag,
            slot_number: i,
            is_busy: false,
          });
        }
      }
      if (slotsToCreate.length > 0) {
        await this.prisma.builderSlot.createMany({
          data: slotsToCreate,
        });
      }
    }

    const availableSlot = await this.prisma.builderSlot.findFirst({
      where: { player_tag: formattedTag, is_busy: false, slot_number: { lte: maxBuildersCount } },
      orderBy: { slot_number: 'asc' },
    });

    if (!availableSlot) {
      throw new ConflictException(
        `All ${maxBuildersCount} builders are currently busy! Complete or cancel an upgrade first.`,
      );
    }

    // Update slot and create timer in transaction
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

    const category = this.getItemCategory(timer.item_name);
    const village = this.getItemVillage(timer.item_name);

    return this.prisma.$transaction(async (tx) => {
      // Free builder slot if it's not a Laboratory upgrade (slot 0)
      if (timer.builder_slot > 0) {
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
      }

      // Mark timer as completed
      await tx.upgradeTimer.update({
        where: { id: upgradeId },
        data: { status: 'COMPLETED' },
      });

      // Upsert into appropriate table based on category
      if (category === 'Troops' || category === 'Spells') {
        return tx.troop.upsert({
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
            village,
          },
          update: {
            level: timer.target_level,
          },
        });
      } else if (category === 'Heroes') {
        return tx.hero.upsert({
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
            village,
          },
          update: {
            level: timer.target_level,
          },
        });
      } else {
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
            village,
          },
          update: {
            level: timer.target_level,
          },
        });
      }
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
      // Free builder slot if it's not a Laboratory upgrade (slot 0)
      if (timer.builder_slot > 0) {
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
      }

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

        if (timer.builder_slot > 0) {
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
      }
    });

    return { message: 'Successfully applied Builder Potion boost (reduced durations by 9 hours)' };
  }
}

