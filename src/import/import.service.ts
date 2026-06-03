import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  private getNameFromId(id: number): string | null {
    const mappings: Record<number, string> = {
      // Buildings
      1000000: "Cannon",
      1000001: "Town Hall",
      1000002: "Archer Tower",
      1000003: "Mortar",
      1000004: "Air Defense",
      1000005: "Wizard Tower",
      1000006: "Air Sweeper",
      1000007: "Hidden Tesla",
      1000008: "Laboratory",
      1000009: "Spell Factory",
      1000010: "Walls",
      1000011: "Gold Mine",
      1000012: "Elixir Collector",
      1000013: "Gold Storage",
      1000014: "Elixir Storage",
      1000015: "Barracks",
      1000019: "Clan Castle",
      1000020: "Dark Elixir Storage",
      1000021: "Dark Elixir Drill",
      1000023: "Army Camp",
      1000024: "Spell Factory",
      1000026: "Dark Barracks",
      1000027: "Dark Spell Factory",
      1000028: "Eagle Artillery",
      1000029: "Scattershot",
      1000031: "Monolith",
      1000032: "Ricochet Cannon",
      1000059: "Multi-Archer Tower",
      1000067: "Spell Tower",
      1000068: "Blacksmith",
      1000071: "Workshop",
      1000072: "Pet House",

      // Troops / Characters (units)
      4000000: "Barbarian",
      4000001: "Archer",
      4000002: "Goblin",
      4000003: "Giant",
      4000004: "Wall Breaker",
      4000005: "Balloon",
      4000006: "Wizard",
      4000007: "Healer",
      4000008: "Dragon",
      4000009: "P.E.K.K.A",
      4000010: "Minion",
      4000011: "Hog Rider",
      4000012: "Valkyrie",
      4000013: "Golem",
      4000015: "Witch",
      4000017: "Lava Hound",
      4000022: "Bowler",
      4000023: "Baby Dragon",
      4000024: "Miner",
      4000053: "Yeti",
      4000059: "Electro Dragon",

      // Siege Machines
      4000051: "Wall Wrecker",
      4000052: "Battle Blimp",
      4000062: "Stone Slammer",
      4000075: "Siege Barracks",
      4000087: "Log Launcher",
      4000091: "Flame Flinger",
      4000092: "Battle Drill",

      // Spells
      26000000: "Lightning Spell",
      26000001: "Healing Spell",
      26000002: "Rage Spell",
      26000003: "Jump Spell",
      26000005: "Freeze Spell",
      26000009: "Poison Spell",
      26000010: "Earthquake Spell",
      26000011: "Haste Spell",
      26000016: "Clone Spell",
      26000017: "Skeleton Spell",
      26000035: "Invisibility Spell",
      26000053: "Recall Spell",

      // Heroes
      28000000: "Barbarian King",
      28000001: "Archer Queen",
      28000002: "Grand Warden",
      28000004: "Royal Champion",
      28000006: "Minion Prince",
      28000007: "Dragon Duke",

      // Hero Equipment
      90000000: "Barbarian Puppet",
      90000001: "Archer Puppet",
      90000002: "Giant Gauntlet",
      90000003: "Frozen Arrow",
      90000004: "Eternal Tome",
      90000005: "Spiky Ball",
      90000006: "Life Gem",
      90000007: "Rage Gem",
      90000008: "Rage Vial",
      90000009: "Haste Vial",
      90000010: "Invisibility Vial",
      90000011: "Seeking Shield",
      90000013: "Royal Gem",
      90000014: "Vampstache",
      90000015: "Earthquake Boots",
      90000016: "Magic Mirror",
      90000017: "Heroic Torch",
      90000019: "Rocket Spear",
    };
    return mappings[id] || null;
  }

  async importVillageJson(userId: string, payload: any) {
    // Extract player tag and basic info (handle both CoC API format and custom simplified format)
    const rawTag = payload.playerTag || payload.tag;
    const name = payload.name || 'Imported Village';
    let townhallLevel = parseInt(payload.townhallLevel || payload.townHallLevel || '1', 10);

    if (!rawTag) {
      throw new BadRequestException('Missing playerTag or tag in JSON payload');
    }

    const playerTag = rawTag.toUpperCase().trim().startsWith('#')
      ? rawTag.toUpperCase().trim()
      : `#${rawTag.toUpperCase().trim()}`;

    // Extract Town Hall level from buildings array if missing from root (e.g. data: 1000001 is Town Hall)
    if (townhallLevel === 1 && payload.buildings && Array.isArray(payload.buildings)) {
      const thMatch = payload.buildings.find((b: any) => b.data === 1000001 || b.name === 'Town Hall');
      if (thMatch) {
        townhallLevel = parseInt(thMatch.lvl || thMatch.level || '1', 10);
      }
    }

    // Perform database import in a single transaction
    return this.prisma.$transaction(async (tx) => {
      // 1. Create or update PlayerAccount header
      const account = await tx.playerAccount.upsert({
        where: { player_tag: playerTag },
        create: {
          user_id: userId,
          player_tag: playerTag,
          name,
          townhall_level: townhallLevel,
        },
        update: {
          user_id: userId,
          name,
          townhall_level: townhallLevel,
          last_synced_at: new Date(),
        },
      });

      // 2. Cache raw json
      await tx.playerData.upsert({
        where: { player_tag: playerTag },
        create: {
          player_tag: playerTag,
          raw_json: payload,
        },
        update: {
          raw_json: payload,
        },
      });

      // 3. Import buildings
      const buildings = payload.buildings || [];
      for (const b of buildings) {
        const bName = b.name || (b.data ? this.getNameFromId(b.data) : null);
        if (!bName) continue; // Skip unmapped items or Walls (Walls are not tracked in single building upgrade logs)

        const bLevel = parseInt(b.level || b.lvl || '1', 10);

        await tx.building.upsert({
          where: {
            player_tag_name: {
              player_tag: playerTag,
              name: bName,
            },
          },
          create: {
            player_tag: playerTag,
            name: bName,
            level: bLevel,
            village: b.village || 'home',
          },
          update: {
            level: bLevel,
            village: b.village || 'home',
          },
        });
      }

      // If no buildings were imported, seed standard defaults
      const importedBuildings = await tx.building.findMany({
        where: { player_tag: playerTag },
      });

      if (importedBuildings.length === 0) {
        const defaultBuildings = ['Cannon', 'Archer Tower', 'Mortar', 'Air Defense', 'Wizard Tower', 'Air Sweeper', 'Hidden Tesla'];
        for (const bName of defaultBuildings) {
          await tx.building.upsert({
            where: {
              player_tag_name: {
                player_tag: playerTag,
                name: bName,
              },
            },
            create: {
              player_tag: playerTag,
              name: bName,
              level: 1,
              village: 'home',
            },
            update: {},
          });
        }
      }

      // 4. Import troops & spells
      const troops = payload.troops || payload.units || [];
      const spells = payload.spells || [];
      const combinedTroops = [...troops, ...spells];

      for (const t of combinedTroops) {
        const tName = t.name || (t.data ? this.getNameFromId(t.data) : null);
        if (!tName) continue;

        const tLevel = parseInt(t.level || t.lvl || '1', 10);

        await tx.troop.upsert({
          where: {
            player_tag_name: {
              player_tag: playerTag,
              name: tName,
            },
          },
          create: {
            player_tag: playerTag,
            name: tName,
            level: tLevel,
            village: t.village || 'home',
          },
          update: {
            level: tLevel,
          },
        });
      }

      // 5. Import heroes
      const heroes = payload.heroes || [];
      for (const h of heroes) {
        const hName = h.name || (h.data ? this.getNameFromId(h.data) : null);
        if (!hName) continue;

        const hLevel = parseInt(h.level || h.lvl || '1', 10);

        await tx.hero.upsert({
          where: {
            player_tag_name: {
              player_tag: playerTag,
              name: hName,
            },
          },
          create: {
            player_tag: playerTag,
            name: hName,
            level: hLevel,
            village: h.village || 'home',
          },
          update: {
            level: hLevel,
          },
        });
      }

      // 6. Provision 5 Builder slots if not exist
      const existingSlots = await tx.builderSlot.findMany({
        where: { player_tag: playerTag },
      });

      if (existingSlots.length === 0) {
        for (let slot = 1; slot <= 5; slot++) {
          await tx.builderSlot.create({
            data: {
              player_tag: playerTag,
              slot_number: slot,
              is_busy: false,
            },
          });
        }
      }

      return account;
    });
  }
}
