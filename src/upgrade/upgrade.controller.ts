import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UpgradeService } from './upgrade.service';
import { StartUpgradeDto } from './dto/start-upgrade.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('upgrade')
@UseGuards(JwtAuthGuard)
export class UpgradeController {
  constructor(private readonly upgradeService: UpgradeService) {}

  @Post('start')
  async startUpgrade(@Req() req: any, @Body() dto: StartUpgradeDto) {
    return this.upgradeService.startUpgrade(req.user.id, dto);
  }

  @Post('complete/:id')
  async completeUpgrade(@Req() req: any, @Param('id') id: string) {
    return this.upgradeService.completeUpgrade(req.user.id, id);
  }

  @Post('cancel/:id')
  async cancelUpgrade(@Req() req: any, @Param('id') id: string) {
    return this.upgradeService.cancelUpgrade(req.user.id, id);
  }

  @Post('boost/:tag')
  async boostUpgrades(@Req() req: any, @Param('tag') tag: string) {
    const formattedTag = tag.startsWith('%23') ? decodeURIComponent(tag) : tag;
    return this.upgradeService.applyBuilderPotionBoost(req.user.id, formattedTag);
  }
}
