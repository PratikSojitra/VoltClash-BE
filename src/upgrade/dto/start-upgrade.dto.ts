import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StartUpgradeDto {
  @IsString()
  playerTag: string;

  @IsString()
  itemName: string;

  @IsInt()
  @Min(1)
  currentLevel: number;

  @IsString()
  @IsOptional()
  village?: string;
}

