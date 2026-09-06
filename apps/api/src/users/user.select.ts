import { Prisma } from '@prisma/client';

/** Fields of a user that are safe to return from the API (never the password hash). */
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  jobTitle: true,
  active: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER_SELECT }>;
