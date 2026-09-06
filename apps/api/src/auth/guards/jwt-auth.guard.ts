import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PUBLIC_USER_SELECT } from '../../users/user.select';
import { AuthUser, JwtPayload } from '../auth-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface RequestLike {
  headers: { authorization?: string };
  user?: AuthUser;
}

/**
 * Registered globally: every route requires a valid bearer token unless it is
 * decorated with @Public(). The user is re-loaded from the database on every
 * request so deactivated accounts and role changes take effect immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestLike>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: PUBLIC_USER_SELECT });
    if (!user || !user.active) throw new UnauthorizedException('Account is inactive or no longer exists');

    request.user = user;
    return true;
  }
}

export function extractBearerToken(header?: string): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
