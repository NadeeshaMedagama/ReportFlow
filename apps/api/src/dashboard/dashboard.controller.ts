import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { ActivityQueryDto, SectionQueryDto, WeekQueryDto, WindowQueryDto } from './dto/dashboard.query';

/** Every dashboard endpoint is manager-only. */
@Roles(Role.MANAGER, Role.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@Query() query: WeekQueryDto) {
    return this.dashboard.summary(query.weekStart);
  }

  @Get('submission-status')
  submissionStatus(@Query() query: WeekQueryDto) {
    return this.dashboard.submissionStatus(query.weekStart);
  }

  @Get('tasks-trend')
  tasksTrend(@Query() query: WindowQueryDto) {
    return this.dashboard.tasksTrend(query.weeks);
  }

  @Get('status-by-member')
  statusByMember(@Query() query: WindowQueryDto) {
    return this.dashboard.statusByMember(query.weeks);
  }

  @Get('workload-by-project')
  workloadByProject(@Query() query: WindowQueryDto) {
    return this.dashboard.workloadByProject(query.weeks);
  }

  @Get('time-by-category')
  timeByCategory(@Query() query: WindowQueryDto) {
    return this.dashboard.timeByCategory(query.weeks);
  }

  @Get('activity')
  activity(@Query() query: ActivityQueryDto) {
    return this.dashboard.activity(query.limit);
  }

  @Get('section-overview')
  sectionOverview(@Query() query: SectionQueryDto) {
    return this.dashboard.sectionOverview(query.weekStart, query.section);
  }
}
