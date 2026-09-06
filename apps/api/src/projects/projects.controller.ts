import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, isManager } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateProjectDto, ListProjectsQueryDto, SetProjectMembersDto, UpdateProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /** Any authenticated user can read projects (needed for the report form). */
  @Get()
  list(@Query() query: ListProjectsQueryDto, @CurrentUser() user: AuthUser) {
    const includeInactive = isManager(user) && query.includeInactive === true;
    return this.projects.list(includeInactive);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }

  @Roles(Role.MANAGER, Role.ADMIN)
  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: AuthUser) {
    return this.projects.create(dto, actor);
  }

  @Roles(Role.MANAGER, Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @CurrentUser() actor: AuthUser) {
    return this.projects.update(id, dto, actor);
  }

  @Roles(Role.MANAGER, Role.ADMIN)
  @Put(':id/members')
  setMembers(@Param('id') id: string, @Body() dto: SetProjectMembersDto, @CurrentUser() actor: AuthUser) {
    return this.projects.setMembers(id, dto.memberIds, actor);
  }

  @Roles(Role.MANAGER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.projects.remove(id, actor);
  }
}
