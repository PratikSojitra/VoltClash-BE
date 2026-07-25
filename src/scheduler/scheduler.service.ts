import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

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
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    return 'Defenses';
  }

  private getItemVillage(name: string): 'home' | 'builder' {
    if (BUILDER_VILLAGE_ITEMS.has(name)) {
      return 'builder';
    }
    return 'home';
  }

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
        const category = this.getItemCategory(timer.item_name);
        const village = this.getItemVillage(timer.item_name);

        await this.prisma.$transaction(async (tx) => {
          // 1. Free the corresponding player's builder slot if not laboratory (slot 0)
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

          // 2. Mark the active timer as completed
          await tx.upgradeTimer.update({
            where: { id: timer.id },
            data: { status: 'COMPLETED' },
          });

          // 3. Save the upgraded building level in the appropriate player profile table
          if (category === 'Troops' || category === 'Spells') {
            await tx.troop.upsert({
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
            await tx.hero.upsert({
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
                village,
              },
              update: {
                level: timer.target_level,
              },
            });
          }
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

