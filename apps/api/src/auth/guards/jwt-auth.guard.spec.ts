import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { extractBearerToken, JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: 'unit-test-secret' });
  const findUnique = jest.fn();
  const getAllAndOverride = jest.fn();
  const guard = new JwtAuthGuard(
    { getAllAndOverride } as unknown as Reflector,
    jwt,
    { user: { findUnique } } as unknown as PrismaService,
  );

  const activeUser = { id: 'u1', name: 'Ava', email: 'ava@test.local', role: Role.TEAM_MEMBER, active: true };

  function contextFor(headers: Record<string, string>) {
    const request: { headers: Record<string, string>; user?: unknown } = { headers };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => getAllAndOverride.mockReturnValue(false));

  it('lets @Public() routes through without a token', async () => {
    getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(contextFor({}).context)).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects requests without a bearer token', async () => {
    await expect(guard.canActivate(contextFor({}).context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects malformed or forged tokens', async () => {
    const forged = new JwtService({ secret: 'another-secret' }).sign({ sub: 'u1', role: Role.ADMIN });
    await expect(guard.canActivate(contextFor({ authorization: `Bearer ${forged}` }).context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(contextFor({ authorization: 'Bearer not-a-jwt' }).context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects tokens of deactivated or deleted users', async () => {
    const token = jwt.sign({ sub: 'u1', role: Role.TEAM_MEMBER });
    findUnique.mockResolvedValueOnce({ ...activeUser, active: false });
    await expect(guard.canActivate(contextFor({ authorization: `Bearer ${token}` }).context)).rejects.toThrow(
      UnauthorizedException,
    );
    findUnique.mockResolvedValueOnce(null);
    await expect(guard.canActivate(contextFor({ authorization: `Bearer ${token}` }).context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches the database user (never the password hash) to the request', async () => {
    const token = jwt.sign({ sub: 'u1', role: Role.TEAM_MEMBER });
    findUnique.mockResolvedValueOnce(activeUser);
    const { context, request } = contextFor({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(activeUser);
    const select = findUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('passwordHash');
  });

  it('parses bearer headers case-insensitively', () => {
    expect(extractBearerToken('bearer abc')).toBe('abc');
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });
});
