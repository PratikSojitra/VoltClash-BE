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
import { PlannerService } from './planner.service';
import { AddPlanDto } from './dto/add-plan.dto';
import { CalculateQueueDto } from './dto/calculate-queue.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('planner')
export class PlannerController {
  constructor(private readonly plannerService: PlannerService) {}

  @Post('plan')
  @UseGuards(JwtAuthGuard)
  async addUpgradePlan(@Req() req: any, @Body() dto: AddPlanDto) {
    return this.plannerService.addUpgradePlan(req.user.id, dto);
  }

  @Get('plans/:tag')
  @UseGuards(JwtAuthGuard)
  async listUpgradePlans(@Req() req: any, @Param('tag') tag: string) {
    const formattedTag = tag.startsWith('%23') ? decodeURIComponent(tag) : tag;
    return this.plannerService.listUpgradePlans(req.user.id, formattedTag);
  }

  @Delete('plan/:id')
  @UseGuards(JwtAuthGuard)
  async deleteUpgradePlan(@Req() req: any, @Param('id') id: string) {
    return this.plannerService.deleteUpgradePlan(req.user.id, id);
  }

  @Patch('plan/:id/priority')
  @UseGuards(JwtAuthGuard)
  async updatePlanPriority(
    @Req() req: any,
    @Param('id') id: string,
    @Body('priority') priority: number,
  ) {
    return this.plannerService.updatePlanPriority(req.user.id, id, priority);
  }

  // Cost/Time calculation engine sandbox (doesn't require DB storage)
  @Post('calculate')
  async calculateQueue(@Body() dto: CalculateQueueDto) {
    return this.plannerService.calculateQueue(dto);
  }
}
