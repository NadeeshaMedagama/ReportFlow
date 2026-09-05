import { Role, type PublicUser } from '@weekly-report/shared';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
}

const MANAGER_ROLES: Role[] = [Role.MANAGER, Role.ADMIN];

/** Sidebar navigation, filtered by role at render time. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', roles: MANAGER_ROLES },
  { href: '/team-reports', label: 'Team reports', icon: '🗂️', roles: MANAGER_ROLES },
  { href: '/team', label: 'Team', icon: '👥', roles: MANAGER_ROLES },
  { href: '/projects', label: 'Projects', icon: '📁', roles: MANAGER_ROLES },
  { href: '/users', label: 'Users', icon: '🛡️', roles: [Role.ADMIN] },
  { href: '/my-reports', label: 'My reports', icon: '📝', roles: [Role.TEAM_MEMBER] },
  { href: '/my-reports/new', label: 'New report', icon: '➕', roles: [Role.TEAM_MEMBER] },
  { href: '/settings', label: 'Settings', icon: '⚙️', roles: [Role.TEAM_MEMBER, Role.MANAGER, Role.ADMIN] },
];

export function navFor(user: PublicUser | null): NavItem[] {
  if (!user) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(user.role));
}
