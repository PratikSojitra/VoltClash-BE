import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

export class QueueItem {
  @IsString()
  itemName: string;

  @IsInt()
  @Min(1)
  fromLevel: number;

  @IsInt()
  @Min(1)
  toLevel: number;
}

export class CalculateQueueDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueueItem)
  items: QueueItem[];
}
