import { Module } from '@nestjs/common';
import { GameDataService } from './game-data.service';

@Module({
  providers: [GameDataService],
  exports: [GameDataService],
})
export class GameDataModule {}
