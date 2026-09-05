import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ActivityType, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { PUBLIC_USER_SELECT, PublicUser } from '../users/user.select';
import { AuthUser, JwtPayload } from './auth-user';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Self-service registration always creates a TEAM_MEMBER; admins promote users later. */
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        jobTitle: dto.jobTitle?.trim() || null,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: Role.TEAM_MEMBER,
      },
      select: PUBLIC_USER_SELECT,
    });
    await this.prisma.activityLog.create({ data: { type: ActivityType.USER_REGISTERED, actorId: user.id } });

    return this.buildSession(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.active) throw new UnauthorizedException('This account has been deactivated');

    const { passwordHash: _passwordHash, updatedAt: _updatedAt, ...publicUser } = user;
    return this.buildSession(publicUser);
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto): Promise<PublicUser> {
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: dto.name?.trim(),
        jobTitle: dto.jobTitle === undefined ? undefined : dto.jobTitle.trim() || null,
      },
      select: PUBLIC_USER_SELECT,
    });
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const record = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await bcrypt.compare(dto.currentPassword, record.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });
    return { success: true };
  }

  private async buildSession(user: PublicUser) {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user };
  }
}
