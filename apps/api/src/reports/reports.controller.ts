import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ListReportsQueryDto } from './dto/list-reports.query';
import { UpsertReportDto } from './dto/report.dto';
import { ReviewReportDto } from './dto/review.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Paginated + filterable. Team members only ever receive their own reports. */
  @Get()
  list(@Query() query: ListReportsQueryDto, @CurrentUser() user: AuthUser) {
    return this.reports.list(query, user);
  }

  @Roles(Role.TEAM_MEMBER)
  @Post()
  create(@Body() dto: UpsertReportDto, @CurrentUser() user: AuthUser) {
    return this.reports.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reports.findOne(id, user);
  }

  @Roles(Role.TEAM_MEMBER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertReportDto, @CurrentUser() user: AuthUser) {
    return this.reports.update(id, dto, user);
  }

  @Roles(Role.TEAM_MEMBER)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reports.remove(id, user);
  }

  @Roles(Role.TEAM_MEMBER)
  @HttpCode(200)
  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reports.submit(id, user);
  }

  /** Manager decision: { decision: "APPROVE" | "REQUEST_CHANGES", comment? } */
  @Roles(Role.MANAGER, Role.ADMIN)
  @HttpCode(200)
  @Post(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewReportDto, @CurrentUser() user: AuthUser) {
    return this.reports.review(id, dto, user);
  }

  @Get(':id/versions')
  versions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reports.listVersions(id, user);
  }

  @Get(':id/versions/:versionId')
  version(@Param('id') id: string, @Param('versionId') versionId: string, @CurrentUser() user: AuthUser) {
    return this.reports.getVersion(id, versionId, user);
  }

  @Get(':id/reviews')
  reviews(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reports.listReviews(id, user);
  }
}
