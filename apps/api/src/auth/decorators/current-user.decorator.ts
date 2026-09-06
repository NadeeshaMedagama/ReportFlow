import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../auth-user';

/** Injects the authenticated user (set by JwtAuthGuard) into a handler parameter. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
