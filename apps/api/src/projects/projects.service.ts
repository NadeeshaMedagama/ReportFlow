import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../common/prisma/prisma.service';
import { PUBLIC_USER_SELECT } from '../users/user.select';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

const PROJECT_INCLUDE = {
  members: { select: { user: { select: PUBLIC_USER_SELECT } }, orderBy: { user: { name: 'asc' } } },
  _count: { select: { reports: true } },
} satisfies Prisma.ProjectInclude;

type ProjectRecord = Prisma.ProjectGetPayload<{ include: typeof PROJECT_INCLUDE }>;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeInactive = false) {
    const projects = await this.prisma.project.findMany({
      where: includeInactive ? {} : { active: true },
      include: PROJECT_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return projects.map(shapeProject);
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id }, include: PROJECT_INCLUDE });
    if (!project) throw new NotFoundException('Project not found');
    return shapeProject(project);
  }

  async create(dto: CreateProjectDto, actor: AuthUser) {
    const name = dto.name.trim();
    await this.assertNameAvailable(name);
    const memberIds = await this.validateMemberIds(dto.memberIds);

    const project = await this.prisma.project.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: PROJECT_INCLUDE,
    });
    await this.log(ActivityType.PROJECT_CREATED, actor, project.id, project.name);
    return shapeProject(project);
  }

  async update(id: string, dto: UpdateProjectDto, actor: AuthUser) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Project not found');

    const name = dto.name?.trim();
    if (name && name.toLowerCase() !== existing.name.toLowerCase()) await this.assertNameAvailable(name);
    const memberIds = dto.memberIds === undefined ? undefined : await this.validateMemberIds(dto.memberIds);

    const project = await this.prisma.$transaction(async (tx) => {
      if (memberIds) {
        await tx.projectMember.deleteMany({ where: { projectId: id } });
        await tx.projectMember.createMany({ data: memberIds.map((userId) => ({ userId, projectId: id })) });
      }
      return tx.project.update({
        where: { id },
        data: {
          name,
          description: dto.description === undefined ? undefined : dto.description.trim() || null,
          active: dto.active,
        },
        include: PROJECT_INCLUDE,
      });
    });
    await this.log(ActivityType.PROJECT_UPDATED, actor, project.id, project.name);
    return shapeProject(project);
  }

  async setMembers(id: string, memberIds: string[], actor: AuthUser) {
    return this.update(id, { memberIds }, actor);
  }

  /**
   * Delete a project. Projects that already have reports attached are archived
   * (active = false) instead, so historical reports keep their category tag.
   */
  async remove(id: string, actor: AuthUser) {
    const project = await this.prisma.project.findUnique({ where: { id }, include: PROJECT_INCLUDE });
    if (!project) throw new NotFoundException('Project not found');

    const archived = project._count.reports > 0;
    if (archived) {
      await this.prisma.project.update({ where: { id }, data: { active: false } });
    } else {
      await this.prisma.project.delete({ where: { id } });
    }
    await this.log(ActivityType.PROJECT_DELETED, actor, id, project.name, { archived });
    return { id, archived };
  }

  private async assertNameAvailable(name: string) {
    const clash = await this.prisma.project.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`A project named "${name}" already exists`);
  }

  private async validateMemberIds(memberIds?: string[]): Promise<string[]> {
    const unique = Array.from(new Set(memberIds ?? []));
    if (unique.length === 0) return [];
    const found = await this.prisma.user.count({ where: { id: { in: unique }, active: true } });
    if (found !== unique.length) throw new BadRequestException('One or more member ids do not exist or are inactive');
    return unique;
  }

  private log(type: ActivityType, actor: AuthUser, projectId: string, projectName: string, extra: object = {}) {
    return this.prisma.activityLog.create({
      data: { type, actorId: actor.id, details: { projectId, projectName, ...extra } },
    });
  }
}

function shapeProject(project: ProjectRecord) {
  const { members, _count, ...rest } = project;
  return { ...rest, members: members.map((m) => m.user), reportCount: _count.reports };
}
