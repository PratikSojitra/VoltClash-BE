import { Module } from '@nestjs/common';
import { UpgradeService } from './upgrade.service';
import { UpgradeController } from './upgrade.controller';
import { GameDataModule } from '../game-data/game-data.module';

@Module({
  imports: [GameDataModule],
  controllers: [UpgradeController],
  providers: [UpgradeService],
  exports: [UpgradeService],
})
export class UpgradeModule {}
