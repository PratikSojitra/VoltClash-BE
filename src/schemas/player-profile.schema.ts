import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type PlayerProfileDocument = PlayerProfile & Document;

@Schema()
export class Hero {
  @Prop()
  name: string;

  @Prop()
  level: number;

  @Prop()
  village: string;
}

@Schema()
export class Troop {
  @Prop()
  name: string;

  @Prop()
  level: number;

  @Prop()
  village: string;
}

@Schema()
export class Spell {
  @Prop()
  name: string;

  @Prop()
  level: number;

  @Prop()
  village: string;
}

@Schema()
export class PlayerProfile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  userId: string;

  @Prop({ required: true })
  playerTag: string;

  @Prop()
  name: string;

  @Prop()
  townHallLevel: number;

  @Prop()
  builderHallLevel: number;

  @Prop({ default: Date.now })
  lastApiSync: Date;

  @Prop({
    type: {
      builderCount: { type: Number, default: 5 },
      hasGoldPass: { type: Boolean, default: false },
      apprenticeBuilderLevel: { type: Number, default: 0 },
    },
  })
  settings: {
    builderCount: number;
    hasGoldPass: boolean;
    apprenticeBuilderLevel: number;
  };

  @Prop({
    type: {
      heroes: [SchemaFactory.createForClass(Hero)],
      troops: [SchemaFactory.createForClass(Troop)],
      spells: [SchemaFactory.createForClass(Spell)],
    },
  })
  stats: {
    heroes: Hero[];
    troops: Troop[];
    spells: Spell[];
  };
}

export const PlayerProfileSchema = SchemaFactory.createForClass(PlayerProfile);
