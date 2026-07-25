import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PlannerModule } from '../planner/planner.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GameDataModule } from '../game-data/game-data.module';

@Module({
  imports: [PrismaModule, PlannerModule, GameDataModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
