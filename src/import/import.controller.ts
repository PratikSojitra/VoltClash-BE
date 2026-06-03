import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ImportService } from './import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('player')
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('import-json')
  async importVillageJson(@Req() req: any, @Body() payload: any) {
    return this.importService.importVillageJson(req.user.id, payload);
  }
}
