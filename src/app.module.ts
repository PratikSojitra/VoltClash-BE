import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlayerModule } from './player/player.module';
import { ClashApiModule } from './clash-api/clash-api.module';
import { GameDataModule } from './game-data/game-data.module';
import { UpgradeModule } from './upgrade/upgrade.module';
import { PlannerModule } from './planner/planner.module';
import { ImportModule } from './import/import.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    PlayerModule,
    ClashApiModule,
    GameDataModule,
    UpgradeModule,
    PlannerModule,
    ImportModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
