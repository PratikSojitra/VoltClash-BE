import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface UpgradeDetails {
  name: string;
  level: number;
  cost: number;
  durationSeconds: number;
  requiredTownHall: number;
  resourceType: 'Gold' | 'Elixir' | 'Dark Elixir';
}

@Injectable()
export class GameDataService implements OnModuleInit {
  private readonly logger = new Logger(GameDataService.name);
  private data: any;

  onModuleInit() {
    try {
      // Find the defenses.json. We handle both development/dist paths by checking standard offsets
      let filePath = path.join(process.cwd(), 'src', 'data', 'defenses.json');
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, '..', 'data', 'defenses.json');
      }

      if (!fs.existsSync(filePath)) {
        this.logger.warn(`defenses.json not found at ${filePath}, using empty fallbacks`);
        this.data = { defenses: {} };
        return;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      this.data = JSON.parse(fileContent);
      this.logger.log('Game defenses data successfully loaded');
    } catch (error) {
      this.logger.error('Error loading defenses.json game data file', error.stack);
      this.data = { defenses: {} };
    }
  }

  getBuildingUpgrade(name: string, targetLevel: number): UpgradeDetails {
    const cleanName = this.findMatchingKey(name);
    
    if (!cleanName || !this.data.defenses[cleanName]) {
      this.logger.warn(`Building type '${name}' not found in database game data, returning fallback`);
      return this.getFallbackUpgrade(name, targetLevel);
    }

    const levels = this.data.defenses[cleanName].levels;
    const levelKey = targetLevel.toString();

    if (!levels || !levels[levelKey]) {
      this.logger.warn(`Building '${cleanName}' level ${targetLevel} configuration not found`);
      return this.getFallbackUpgrade(cleanName, targetLevel);
    }

    const config = levels[levelKey];
    
    // In CoC, defenses cost Gold, barracks/laboratory cost Elixir/Dark Elixir
    const resourceType = cleanName.toLowerCase().includes('barrack') || cleanName.toLowerCase().includes('spell factory')
      ? 'Elixir'
      : 'Gold';

    return {
      name: cleanName,
      level: targetLevel,
      cost: parseInt(config.cost || '0', 10),
      durationSeconds: this.parseDurationToSeconds(config.time),
      requiredTownHall: parseInt(config.required_th || '1', 10),
      resourceType,
    };
  }

  getTroopUpgrade(name: string, targetLevel: number): UpgradeDetails {
    // Fallback Mock troop data (or extensible if laboratory data is loaded)
    return {
      name,
      level: targetLevel,
      cost: targetLevel * 50000,
      durationSeconds: targetLevel * 3600 * 2, // 2 hours per level
      requiredTownHall: Math.max(1, Math.min(16, Math.floor(targetLevel / 2))),
      resourceType: name.toLowerCase().includes('dark') ? 'Dark Elixir' : 'Elixir',
    };
  }

  // Parse strings like "1d 12h", "30m", "5s" to total seconds
  parseDurationToSeconds(durationStr: string): number {
    if (!durationStr) return 0;
    const cleanStr = durationStr.toLowerCase().trim();
    
    let totalSeconds = 0;
    const regex = /(\d+)\s*(d|h|m|s)/g;
    let match;
    let hasMatches = false;
    
    while ((match = regex.exec(cleanStr)) !== null) {
      hasMatches = true;
      const value = parseInt(match[1], 10);
      const unit = match[2];
      
      if (unit === 'd') totalSeconds += value * 86400;
      else if (unit === 'h') totalSeconds += value * 3600;
      else if (unit === 'm') totalSeconds += value * 60;
      else if (unit === 's') totalSeconds += value;
    }
    
    if (!hasMatches) {
      const num = parseInt(cleanStr, 10);
      if (!isNaN(num)) return num;
    }
    
    return totalSeconds;
  }

  private findMatchingKey(name: string): string | null {
    if (!name) return null;
    
    const cleanInput = name.toLowerCase().trim().replace(/[\s-_]/g, '');
    
    for (const key of Object.keys(this.data.defenses || {})) {
      const cleanKey = key.toLowerCase().replace(/[\s-_]/g, '');
      if (cleanKey === cleanInput) {
        return key;
      }
    }
    
    return null;
  }

  private getFallbackUpgrade(name: string, level: number): UpgradeDetails {
    return {
      name,
      level,
      cost: level * 10000,
      durationSeconds: level * 600, // 10 minutes per level
      requiredTownHall: 1,
      resourceType: 'Gold',
    };
  }
}
