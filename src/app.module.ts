import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerProfile, PlayerProfileSchema } from './schemas/player-profile.schema';
import { UpgradeTimer, UpgradeTimerSchema } from './schemas/upgrade-timer.schema';
import { GameData, GameDataSchema } from './schemas/game-data.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: PlayerProfile.name, schema: PlayerProfileSchema },
      { name: UpgradeTimer.name, schema: UpgradeTimerSchema },
      { name: GameData.name, schema: GameDataSchema },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
