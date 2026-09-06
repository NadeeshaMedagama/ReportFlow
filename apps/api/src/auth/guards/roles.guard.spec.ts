import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextWithUser(user: { role: Role } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: Role[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(roles) } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows any authenticated user on routes without @Roles metadata', () => {
    expect(guardRequiring(undefined).canActivate(contextWithUser({ role: Role.TEAM_MEMBER }))).toBe(true);
  });

  it('allows users whose role is listed', () => {
    const guard = guardRequiring([Role.MANAGER, Role.ADMIN]);
    expect(guard.canActivate(contextWithUser({ role: Role.MANAGER }))).toBe(true);
    expect(guard.canActivate(contextWithUser({ role: Role.ADMIN }))).toBe(true);
  });

  it('blocks a team member from a manager-only route', () => {
    const guard = guardRequiring([Role.MANAGER, Role.ADMIN]);
    expect(() => guard.canActivate(contextWithUser({ role: Role.TEAM_MEMBER }))).toThrow(ForbiddenException);
  });

  it('blocks a manager from an admin-only route', () => {
    const guard = guardRequiring([Role.ADMIN]);
    expect(() => guard.canActivate(contextWithUser({ role: Role.MANAGER }))).toThrow(ForbiddenException);
  });

  it('rejects requests that carry no authenticated user', () => {
    const guard = guardRequiring([Role.TEAM_MEMBER]);
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(UnauthorizedException);
  });
});
