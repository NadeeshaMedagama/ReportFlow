import { Role } from '@prisma/client';
import { PublicUser } from '../users/user.select';

/** The authenticated user attached to every request by JwtAuthGuard. */
export type AuthUser = PublicUser;

export interface JwtPayload {
  /** user id */
  sub: string;
  role: Role;
}

export function isManager(user: Pick<AuthUser, 'role'>): boolean {
  return user.role === Role.MANAGER || user.role === Role.ADMIN;
}
