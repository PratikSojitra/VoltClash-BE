import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddPlanDto {
  @IsString()
  playerTag: string;

  @IsString()
  itemName: string;

  @IsInt()
  @Min(1)
  fromLevel: number;

  @IsInt()
  @Min(1)
  toLevel: number;

  @IsInt()
  @IsOptional()
  priority?: number;
}
