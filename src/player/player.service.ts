import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClashApiService } from '../clash-api/clash-api.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clashApiService: ClashApiService,
  ) {}

  private formatTag(tag: string): string {
    let formatted = tag.toUpperCase().trim();
    if (!formatted.startsWith('#')) {
      formatted = `#${formatted}`;
    }
    return formatted;
  }

  private getDefaultBuildingLevel(name: string, th: number): number {
    try {
      const filePath = path.join(process.cwd(), 'src', 'data', 'defenses.json');
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);

        // Lookup building configurations in defenses, resources, or army JSON keys (handling hyphen spacing overlaps)
        const cleanName = name;
        const cleanNameSpace = name.replace('-', ' ');
        const categoryData =
          data.defenses?.[cleanName] ||
          data.defenses?.[cleanNameSpace] ||
          data.resources?.[cleanName] ||
          data.resources?.[cleanNameSpace] ||
          data.army?.[cleanName] ||
          data.army?.[cleanNameSpace];
        if (categoryData && categoryData.levels) {
          let maxLevelForTH = 1;
          for (const [lvlStr, lvlInfo] of Object.entries(categoryData.levels)) {
            const lvl = parseInt(lvlStr, 10);
            const reqThStr = (lvlInfo as any).required_th;
            if (reqThStr) {
              const reqTh = parseInt(reqThStr.replace('*', ''), 10);
              if (reqTh <= th) {
                maxLevelForTH = Math.max(maxLevelForTH, lvl);
              }
            }
          }
          return maxLevelForTH;
        }
      }
    } catch (err) {
      console.error('Failed to parse defenses.json:', err);
    }

    // Fallbacks if file parsing fails
    const fallbacks: Record<string, number> = {
      'Cannon': 16,
      'Archer Tower': 16,
      'Mortar': 14,
      'Air Defense': 12,
      'Wizard Tower': 12,
      'Air Sweeper': 7,
      'Hidden Tesla': 13,
    };
    return fallbacks[name] || 1;
  }

  async addPlayerTag(userId: string, tag: string) {
    const formattedTag = this.formatTag(tag);

    // Check if tag already exists in database
    const existing = await this.prisma.playerAccount.findUnique({
      where: { player_tag: formattedTag },
    });

    if (existing) {
      if (existing.user_id !== userId) {
        throw new ConflictException('This player tag is already registered by another user');
      }
      return this.getPlayerDetails(formattedTag);
    }

    // Fetch from Clash API to verify and get details
    const clashData = await this.clashApiService.getPlayerData(formattedTag);

    // Create player account and seed 5 builder slots in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.playerAccount.create({
        data: {
          user_id: userId,
          player_tag: formattedTag,
          name: clashData.name,
          townhall_level: clashData.townHallLevel,
        },
      });

      // Seed 5 standard builders slots
      for (let slot = 1; slot <= 5; slot++) {
        await tx.builderSlot.create({
          data: {
            player_tag: formattedTag,
            slot_number: slot,
            is_busy: false,
          },
        });
      }
    });

    // Run first sync synchronously (which is now optimized and blazing fast!)
    try {
      return await this.syncPlayerAccount(userId, formattedTag);
    } catch (err: any) {
      await this.prisma.playerAccount.delete({
        where: { player_tag: formattedTag },
      }).catch(() => {});
      throw err;
    }
  }

  async listPlayerAccounts(userId: string) {
    return this.prisma.playerAccount.findMany({
      where: { user_id: userId },
      orderBy: { last_synced_at: 'desc' },
    });
  }

  async deletePlayerAccount(userId: string, tag: string) {
    const formattedTag = this.formatTag(tag);

    const account = await this.prisma.playerAccount.findFirst({
      where: { player_tag: formattedTag, user_id: userId },
    });

    if (!account) {
      throw new NotFoundException(`Player tag ${formattedTag} not associated with this user`);
    }

    await this.prisma.playerAccount.delete({
      where: { player_tag: formattedTag },
    });

    return { message: `Successfully deleted player tag ${formattedTag}` };
  }

  async syncPlayerAccount(userId: string, tag: string) {
    const formattedTag = this.formatTag(tag);

    const account = await this.prisma.playerAccount.findFirst({
      where: { player_tag: formattedTag, user_id: userId },
    });

    if (!account) {
      throw new NotFoundException(`Player tag ${formattedTag} not associated with this user`);
    }

    // Fetch live data from Clash of Clans API
    const rawData = await this.clashApiService.getPlayerData(formattedTag);

    // 1. Update header metadata
    await this.prisma.playerAccount.update({
      where: { player_tag: formattedTag },
      data: {
        name: rawData.name,
        townhall_level: rawData.townHallLevel,
        last_synced_at: new Date(),
      },
    });

    // 2. Cache raw JSON profile
    await this.prisma.playerData.upsert({
      where: { player_tag: formattedTag },
      create: {
        player_tag: formattedTag,
        raw_json: rawData,
      },
      update: {
        raw_json: rawData,
      },
    });

    // 3. Sync normalized Troops & Spells (In-memory comparison to reduce writes to near-zero)
    const dbTroops = await this.prisma.troop.findMany({
      where: { player_tag: formattedTag },
    });
    const dbTroopMap = new Map(dbTroops.map((t) => [t.name, t.level]));

    const rawTroops = rawData.troops || [];
    const rawSpells = rawData.spells || [];
    const combinedTroops = [...rawTroops, ...rawSpells];

    for (const t of combinedTroops) {
      if (dbTroopMap.has(t.name)) {
        if (dbTroopMap.get(t.name) !== t.level) {
          await this.prisma.troop.update({
            where: {
              player_tag_name: {
                player_tag: formattedTag,
                name: t.name,
              },
            },
            data: { level: t.level },
          });
        }
      } else {
        await this.prisma.troop.create({
          data: {
            player_tag: formattedTag,
            name: t.name,
            level: t.level,
            village: t.village || 'home',
          },
        });
      }
    }

    // 4. Sync normalized Heroes (In-memory comparison to reduce writes to near-zero)
    const dbHeroes = await this.prisma.hero.findMany({
      where: { player_tag: formattedTag },
    });
    const dbHeroMap = new Map(dbHeroes.map((h) => [h.name, h.level]));

    const rawHeroes = rawData.heroes || [];
    for (const h of rawHeroes) {
      if (dbHeroMap.has(h.name)) {
        if (dbHeroMap.get(h.name) !== h.level) {
          await this.prisma.hero.update({
            where: {
              player_tag_name: {
                player_tag: formattedTag,
                name: h.name,
              },
            },
            data: { level: h.level },
          });
        }
      } else {
        await this.prisma.hero.create({
          data: {
            player_tag: formattedTag,
            name: h.name,
            level: h.level,
            village: h.village || 'home',
          },
        });
      }
    }

    // 5. Initialize standard default buildings if they do not exist (In-memory check & level-1 healing)
    const dbBuildings = await this.prisma.building.findMany({
      where: { player_tag: formattedTag },
    });
    const dbBuildingMap = new Map(dbBuildings.map((b) => [b.name, b.level]));

    const defaultBuildings = [
      // Defenses
      'Cannon',
      'Archer Tower',
      'Mortar',
      'Air Defense',
      'Wizard Tower',
      'Air Sweeper',
      'Hidden Tesla',
      'Bomb Tower',
      'X-Bow',
      'Inferno Tower',
      'Eagle Artillery',
      'Scattershot',
      'Monolith',
      'Ricochet Cannon',
      'Multi-Archer Tower',
      'Spell Tower',
      // Army
      'Army Camp',
      'Barracks',
      'Dark Barracks',
      'Laboratory',
      'Spell Factory',
      'Dark Spell Factory',
      'Clan Castle',
      'Pet House',
      'Workshop',
      'Blacksmith',
      // Resources
      'Gold Mine',
      'Elixir Collector',
      'Dark Elixir Drill',
      'Gold Storage',
      'Elixir Storage',
      'Dark Elixir Storage',
    ];
    for (const bName of defaultBuildings) {
      const defaultLvl = this.getDefaultBuildingLevel(bName, rawData.townHallLevel);
      if (dbBuildingMap.has(bName)) {
        // Heal existing records: If a building is currently level 1 but has a higher resolved default level, update it!
        if (dbBuildingMap.get(bName) === 1 && defaultLvl > 1) {
          await this.prisma.building.update({
            where: {
              player_tag_name: {
                player_tag: formattedTag,
                name: bName,
              },
            },
            data: { level: defaultLvl },
          });
        }
      } else {
        await this.prisma.building.create({
          data: {
            player_tag: formattedTag,
            name: bName,
            level: defaultLvl,
            village: 'home',
          },
        });
      }
    }

    return this.getPlayerDetails(formattedTag);
  }

  async getPlayerDetails(tag: string) {
    const formattedTag = this.formatTag(tag);
    const details = await this.prisma.playerAccount.findUnique({
      where: { player_tag: formattedTag },
      include: {
        buildings: true,
        troops: true,
        heroes: true,
        builders: true,
        upgrades: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!details) {
      throw new NotFoundException(`Player account details not found for tag ${formattedTag}`);
    }

    return details;
  }

  /**
   * Bulk-upsert pre-mapped levels from the frontend.
   * The frontend resolves all numeric IDs to names using defenses.json,
   * so this endpoint simply persists what it receives.
   */
  async updatePlayerLevels(
    userId: string,
    body: {
      playerTag: string;
      buildings?: { name: string; level: number; village?: string }[];
      troops?: { name: string; level: number; village?: string }[];
      heroes?: { name: string; level: number; village?: string }[];
    },
  ) {
    const formattedTag = this.formatTag(body.playerTag);

    // Verify ownership
    const account = await this.prisma.playerAccount.findFirst({
      where: { player_tag: formattedTag, user_id: userId },
    });
    if (!account) {
      throw new NotFoundException(`Player tag ${formattedTag} not associated with this user`);
    }

    // Upsert buildings
    for (const b of body.buildings || []) {
      if (!b.name) continue;
      await this.prisma.building.upsert({
        where: { player_tag_name: { player_tag: formattedTag, name: b.name } },
        create: { player_tag: formattedTag, name: b.name, level: b.level, village: b.village || 'home' },
        update: { level: b.level, village: b.village || 'home' },
      });
    }

    // Upsert troops
    for (const t of body.troops || []) {
      if (!t.name) continue;
      await this.prisma.troop.upsert({
        where: { player_tag_name: { player_tag: formattedTag, name: t.name } },
        create: { player_tag: formattedTag, name: t.name, level: t.level, village: t.village || 'home' },
        update: { level: t.level },
      });
    }

    // Upsert heroes
    for (const h of body.heroes || []) {
      if (!h.name) continue;
      await this.prisma.hero.upsert({
        where: { player_tag_name: { player_tag: formattedTag, name: h.name } },
        create: { player_tag: formattedTag, name: h.name, level: h.level, village: h.village || 'home' },
        update: { level: h.level },
      });
    }

    // Update last_synced_at
    await this.prisma.playerAccount.update({
      where: { player_tag: formattedTag },
      data: { last_synced_at: new Date() },
    });

    return this.getPlayerDetails(formattedTag);
  }
}
