import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlayerService } from './player.service';
import { AddTagDto } from './dto/add-tag.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('player')
@UseGuards(JwtAuthGuard)
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post('tag')
  async addPlayerTag(@Req() req: any, @Body() dto: AddTagDto) {
    return this.playerService.addPlayerTag(req.user.id, dto.playerTag);
  }

  @Get('tags')
  async listPlayerAccounts(@Req() req: any) {
    return this.playerService.listPlayerAccounts(req.user.id);
  }

  @Delete('tag/:tag')
  async deletePlayerAccount(@Req() req: any, @Param('tag') tag: string) {
    const decodedTag = tag.startsWith('%23') ? decodeURIComponent(tag) : tag;
    return this.playerService.deletePlayerAccount(req.user.id, decodedTag);
  }

  @Post('sync/:tag')
  async syncPlayerAccount(@Req() req: any, @Param('tag') tag: string) {
    const decodedTag = tag.startsWith('%23') ? decodeURIComponent(tag) : tag;
    return this.playerService.syncPlayerAccount(req.user.id, decodedTag);
  }

  @Get('details/:tag')
  async getPlayerDetails(@Req() req: any, @Param('tag') tag: string) {
    const decodedTag = tag.startsWith('%23') ? decodeURIComponent(tag) : tag;
    return this.playerService.getPlayerDetails(decodedTag);
  }

  /**
   * Accepts pre-mapped levels from the frontend (no ID translation needed).
   * Body: { playerTag, buildings?: [{name,level,village?}], troops?: [{name,level}], heroes?: [{name,level}] }
   */
  @Patch('levels')
  async updatePlayerLevels(@Req() req: any, @Body() body: any) {
    return this.playerService.updatePlayerLevels(req.user.id, body);
  }
}

