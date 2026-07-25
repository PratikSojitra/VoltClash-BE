import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat with Groq AI assistant' })
  async chat(
    @Req() req: any,
    @Body() body: { playerTag: string; messages: any[] },
  ) {
    const userId = req.user.userId;
    return this.aiService.handleChat(userId, body.playerTag, body.messages);
  }
}
