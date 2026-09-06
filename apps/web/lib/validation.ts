import { TaskPriority, TaskStatus, WorkCategory } from '@weekly-report/shared';
import { z } from 'zod';
import { isMonday } from './format';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72)
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Password must contain a letter and a number');

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email: z.string().trim().email('Enter a valid email address'),
    jobTitle: z.string().trim().max(80).optional(),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const projectSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  description: z.string().trim().max(500).optional(),
});

export const inviteUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Enter a valid email address'),
  jobTitle: z.string().trim().max(80).optional(),
  role: z.enum(['TEAM_MEMBER', 'MANAGER', 'ADMIN']),
  password,
});

// ---------------------------------------------------------------------------
// Weekly report form
// ---------------------------------------------------------------------------

const percent = z.coerce.number().int('Whole numbers only').min(0, 'Min 0').max(100, 'Max 100');
const hours = z.coerce.number().min(0, 'Min 0').max(168, 'Max 168');

export const taskSchema = z.object({
  name: z.string().trim().min(1, 'Task name is required').max(200),
  priority: z.enum(Object.values(TaskPriority) as [TaskPriority, ...TaskPriority[]]),
  status: z.enum(Object.values(TaskStatus) as [TaskStatus, ...TaskStatus[]]),
  plannedPercent: percent,
  actualPercent: percent,
  plannedHours: hours,
  actualHours: hours,
  output: z.string().trim().max(500).optional(),
});

export const listItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500),
  isKey: z.boolean(),
});

export const hoursEntrySchema = z.object({
  category: z.enum(Object.values(WorkCategory) as [WorkCategory, ...WorkCategory[]]),
  hours,
});

/** Rules that apply when saving a draft (structure must be valid, content may be incomplete). */
export const reportDraftSchema = z.object({
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Select the week')
    .refine(isMonday, 'The week must start on a Monday'),
  projectId: z.string().min(1, 'Select a project'),
  tasks: z.array(taskSchema).max(50),
  nextWeekPlan: z.string().trim().max(5000),
  blockers: z.array(listItemSchema).max(20).refine((items) => items.filter((i) => i.isKey).length <= 1, 'Only one key blocker'),
  achievements: z
    .array(listItemSchema)
    .max(20)
    .refine((items) => items.filter((i) => i.isKey).length <= 1, 'Only one key achievement'),
  hours: z.array(hoursEntrySchema).max(10),
  notes: z.string().trim().max(5000),
  links: z.string().trim().max(2000),
});

/** Stricter rules for submitting for review. */
export const reportSubmitSchema = reportDraftSchema.extend({
  tasks: z.array(taskSchema).min(1, 'Add at least one completed task').max(50),
  nextWeekPlan: z.string().trim().min(10, 'Describe what you plan to do next week (at least 10 characters)').max(5000),
});

export type ReportFormValues = z.infer<typeof reportDraftSchema>;

/** Flatten zod issues into { "path.to.field": message }. */
export function issuesToMap(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!map[key]) map[key] = issue.message;
  }
  return map;
}
