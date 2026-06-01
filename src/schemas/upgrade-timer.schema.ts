import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UpgradeTimerDocument = UpgradeTimer & Document;

@Schema()
export class UpgradeTimer {
  @Prop()
  playerTag: string;

  @Prop()
  buildingKey: string; // e.g., "x-bow"

  @Prop()
  currentLevel: number;

  @Prop()
  targetLevel: number;

  @Prop()
  startTime: Date;

  @Prop()
  endTime: Date; // startTime + duration (adjusted for Gold Pass)

  @Prop()
  builderSlot: number; // 1-6
}

export const UpgradeTimerSchema = SchemaFactory.createForClass(UpgradeTimer);
