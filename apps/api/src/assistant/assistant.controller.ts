import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssistantService } from './assistant.service';
import { ChatRequestDto, TeamSummaryRequestDto } from './dto/assistant.dto';

/** The assistant only answers questions about team data, so it is manager-only. */
@Roles(Role.MANAGER, Role.ADMIN)
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('status')
  status() {
    return this.assistant.status();
  }

  @HttpCode(200)
  @Post('chat')
  chat(@Body() dto: ChatRequestDto, @CurrentUser() user: AuthUser) {
    return this.assistant.chat(dto.messages, user);
  }

  @HttpCode(200)
  @Post('team-summary')
  teamSummary(@Body() dto: TeamSummaryRequestDto, @CurrentUser() user: AuthUser) {
    return this.assistant.teamSummary(dto.weekStart, user);
  }
}
