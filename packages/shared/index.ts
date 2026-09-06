/**
 * Shared enums, labels and API contract types.
 *
 * The NestJS API is the source of truth (Prisma enums + DTOs); this package
 * mirrors them so the Next.js web app is typed end to end without importing
 * server code.
 */

// ---------------------------------------------------------------------------
// Enums (mirror prisma/schema.prisma)
// ---------------------------------------------------------------------------

export const Role = { TEAM_MEMBER: 'TEAM_MEMBER', MANAGER: 'MANAGER', ADMIN: 'ADMIN' } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ReportStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  NEEDS_CORRECTION: 'NEEDS_CORRECTION',
  APPROVED: 'APPROVED',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

/** Status used on the manager dashboard for members without a report this week. */
export type SubmissionStatus = ReportStatus | 'NOT_STARTED';
export type SubmissionTiming = 'ON_TIME' | 'LATE' | 'PENDING' | 'OVERDUE';

export const TaskPriority = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' } as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const TaskStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const WorkCategory = {
  DEVELOPMENT: 'DEVELOPMENT',
  TESTING: 'TESTING',
  MEETINGS: 'MEETINGS',
  DOCUMENTATION: 'DOCUMENTATION',
  DESIGN: 'DESIGN',
  SUPPORT: 'SUPPORT',
  OTHER: 'OTHER',
} as const;
export type WorkCategory = (typeof WorkCategory)[keyof typeof WorkCategory];

export const ReviewAction = { APPROVED: 'APPROVED', CHANGES_REQUESTED: 'CHANGES_REQUESTED' } as const;
export type ReviewAction = (typeof ReviewAction)[keyof typeof ReviewAction];

export const ReviewDecision = { APPROVE: 'APPROVE', REQUEST_CHANGES: 'REQUEST_CHANGES' } as const;
export type ReviewDecision = (typeof ReviewDecision)[keyof typeof ReviewDecision];

export type ActivityType =
  | 'REPORT_CREATED'
  | 'REPORT_SUBMITTED'
  | 'REPORT_RESUBMITTED'
  | 'REPORT_APPROVED'
  | 'REPORT_CHANGES_REQUESTED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  | 'USER_REGISTERED'
  | 'USER_INVITED'
  | 'USER_ROLE_CHANGED'
  | 'USER_DEACTIVATED'
  | 'USER_REACTIVATED';

// ---------------------------------------------------------------------------
// Labels (single place for UI wording)
// ---------------------------------------------------------------------------

export const ROLE_LABELS: Record<Role, string> = {
  TEAM_MEMBER: 'Team member',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
};

export const REPORT_STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  NEEDS_CORRECTION: 'Needs correction',
  APPROVED: 'Approved',
  NOT_STARTED: 'Not started',
};

export const TIMING_LABELS: Record<SubmissionTiming, string> = {
  ON_TIME: 'On time',
  LATE: 'Late',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  BLOCKED: 'Blocked',
};

export const WORK_CATEGORY_LABELS: Record<WorkCategory, string> = {
  DEVELOPMENT: 'Development',
  TESTING: 'Testing',
  MEETINGS: 'Meetings',
  DOCUMENTATION: 'Documentation',
  DESIGN: 'Design',
  SUPPORT: 'Support',
  OTHER: 'Other',
};

// ---------------------------------------------------------------------------
// API contract types
// ---------------------------------------------------------------------------

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  active: boolean;
  createdAt: string;
}

export interface Session {
  accessToken: string;
  user: PublicUser;
}

export interface ProjectRef {
  id: string;
  name: string;
  active?: boolean;
}

export interface Project extends ProjectRef {
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  members: PublicUser[];
  reportCount: number;
}

export interface TeamUser extends PublicUser {
  projects: ProjectRef[];
  reportCount: number;
}

export interface ReportTask {
  id?: string;
  sortOrder?: number;
  name: string;
  priority: TaskPriority;
  status: TaskStatus;
  plannedPercent: number;
  actualPercent: number;
  plannedHours: number;
  actualHours: number;
  output: string | null;
}

export interface ReportListItem {
  id?: string;
  description: string;
  isKey: boolean;
}

export interface HoursEntry {
  id?: string;
  category: WorkCategory;
  hours: number;
}

export interface ReportPermissions {
  canView: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canDelete: boolean;
  canReview: boolean;
}

/** Row returned by GET /reports. */
export interface ReportSummary {
  id: string;
  userId: string;
  projectId: string;
  weekStart: string;
  weekEnd: string;
  status: ReportStatus;
  currentVersion: number;
  latestReviewComment: string | null;
  firstSubmittedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: PublicUser;
  project: ProjectRef;
  _count: { tasks: number; blockers: number; achievements: number };
  permissions: ReportPermissions;
}

export interface ReportVersionMeta {
  id: string;
  versionNumber: number;
  submittedAt: string;
}

export interface ReviewEntry {
  id: string;
  reportId?: string;
  versionId: string | null;
  action: ReviewAction;
  comment: string | null;
  createdAt: string;
  reviewer: { id: string; name: string; email?: string; role?: Role };
  version: { id: string; versionNumber: number; submittedAt?: string } | null;
}

/** Full report returned by GET /reports/:id. */
export interface ReportDetail extends Omit<ReportSummary, '_count'> {
  nextWeekPlan: string;
  notes: string | null;
  links: string | null;
  tasks: ReportTask[];
  blockers: ReportListItem[];
  achievements: ReportListItem[];
  hours: HoursEntry[];
  versions: ReportVersionMeta[];
  reviews: ReviewEntry[];
}

/** Immutable content stored for every submission. */
export interface ReportSnapshot {
  weekStart: string;
  weekEnd: string;
  project: ProjectRef | null;
  tasks: ReportTask[];
  nextWeekPlan: string;
  blockers: ReportListItem[];
  achievements: ReportListItem[];
  hours: HoursEntry[];
  notes: string | null;
  links: string | null;
}

export interface ReportVersionSummary extends ReportVersionMeta {
  reviews: Array<{
    id: string;
    action: ReviewAction;
    comment: string | null;
    createdAt: string;
    reviewer: { id: string; name: string };
  }>;
}

export interface ReportVersionDetail extends ReportVersionMeta {
  reportId: string;
  snapshot: ReportSnapshot;
  reviews: ReportVersionSummary['reviews'];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Payload for POST /reports and PATCH /reports/:id. */
export interface ReportInput {
  weekStart: string;
  projectId: string;
  tasks: Array<Omit<ReportTask, 'id' | 'sortOrder' | 'output'> & { output?: string }>;
  nextWeekPlan?: string;
  blockers?: Array<{ description: string; isKey?: boolean }>;
  achievements?: Array<{ description: string; isKey?: boolean }>;
  hours?: Array<{ category: WorkCategory; hours: number }>;
  notes?: string;
  links?: string;
}

// Dashboard -----------------------------------------------------------------

export interface WeekInfo {
  weekStart: string;
  weekEnd: string;
  label: string;
  deadline: string;
  deadlinePassed: boolean;
  isCurrentWeek: boolean;
}

export interface DashboardSummary {
  week: WeekInfo;
  totalMembers: number;
  submitted: number;
  onTime: number;
  late: number;
  pending: number;
  notStarted: number;
  drafts: number;
  complianceRate: number;
  byStatus: Record<ReportStatus, number>;
  awaitingReview: number;
  needsCorrection: number;
  approved: number;
  needsCorrectionTotal: number;
  awaitingReviewTotal: number;
  openBlockers: number;
  keyBlockers: number;
}

export interface SubmissionStatusRow {
  user: PublicUser;
  report: {
    id: string;
    status: ReportStatus;
    firstSubmittedAt: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    currentVersion: number;
    project: ProjectRef | null;
    _count: { tasks: number; blockers: number };
  } | null;
  status: SubmissionStatus;
  timing: SubmissionTiming;
}

export interface SubmissionStatusResponse {
  week: WeekInfo;
  rows: SubmissionStatusRow[];
}

export interface TasksTrendResponse {
  weeks: number;
  series: string[];
  rows: Array<Record<string, number | string> & { weekStart: string; label: string; completed: number; tasks: number; hours: number }>;
}

export interface StatusByMemberRow extends Record<ReportStatus, number> {
  userId: string;
  name: string;
  NOT_STARTED: number;
}

export interface WorkloadRow {
  projectId: string;
  name: string;
  reports: number;
  tasks: number;
  completedTasks: number;
  hours: number;
  members: number;
}

export interface TimeByCategoryResponse {
  weeks: number;
  total: number;
  rows: Array<{ category: WorkCategory; label: string; hours: number; share: number }>;
}

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  createdAt: string;
  actor: { id: string; name: string; role: Role } | null;
  report: { id: string; weekStart: string; weekLabel: string; status: ReportStatus; owner: { id: string; name: string } } | null;
  details: Record<string, unknown> | null;
  message: string;
}

export type SectionKey = 'BLOCKERS' | 'ACHIEVEMENTS' | 'NEXT_WEEK' | 'TASKS';

export interface SectionOverviewEntry {
  reportId: string;
  user: PublicUser;
  project: ProjectRef;
  status: ReportStatus;
  items: ReportListItem[];
  text: string | null;
  tasks: ReportTask[];
}

export interface SectionOverviewResponse {
  week: WeekInfo;
  section: SectionKey;
  entries: SectionOverviewEntry[];
}

// Team member profile -------------------------------------------------------

export interface MemberProfile {
  user: PublicUser & { projects: ProjectRef[] };
  stats: {
    totalReports: number;
    byStatus: Record<ReportStatus, number>;
    submittedReports: number;
    approvalRate: number;
    onTimeRate: number;
    tasksCompleted: number;
    totalHours: number;
    avgHoursPerWeek: number;
    correctionCycles: number;
    openBlockers: number;
  };
  weekly: Array<{
    weekStart: string;
    label: string;
    reportId: string | null;
    status: SubmissionStatus;
    hours: number;
    tasksCompleted: number;
  }>;
}

// Assistant -----------------------------------------------------------------

export interface AssistantStatus {
  enabled: boolean;
  model: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  toolsUsed: string[];
  stopReason: string;
}

export interface TeamSummaryResponse {
  weekStart: string;
  weekLabel: string;
  summary: string;
  model: string;
  generatedAt: string;
}
