import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameDataDocument = GameData & Document;

@Schema()
export class LevelData {
  @Prop()
  level: number;

  @Prop()
  cost: number;

  @Prop()
  durationSeconds: number;

  @Prop()
  requiredTownHall: number;
}

@Schema()
export class GameData {
  @Prop({ type: String, enum: ['building', 'troop', 'hero', 'spell'] })
  type: string;

  @Prop()
  name: string;

  @Prop({ type: [SchemaFactory.createForClass(LevelData)] })
  levels: LevelData[];
}

export const GameDataSchema = SchemaFactory.createForClass(GameData);
