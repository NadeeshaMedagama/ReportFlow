import Anthropic from '@anthropic-ai/sdk';

/**
 * Tools the assistant may call. Each one maps to a read-only database query in
 * AssistantService.runTool. Draft reports are never exposed and e-mail
 * addresses are never included in tool output.
 */
export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_team_members',
    description: 'List active team members with their job title and project assignments.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_projects',
    description: 'List projects / work categories with their descriptions and assigned members.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_week_overview',
    description:
      'Get submission compliance metrics and the per-member submission status for one reporting week. ' +
      'Use this for questions like "who has not submitted yet" or "how many reports are approved".',
    input_schema: {
      type: 'object',
      properties: {
        weekStart: {
          type: 'string',
          description: 'Monday of the week in YYYY-MM-DD format. Omit for the current week.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_reports',
    description:
      'Fetch the full content of submitted weekly reports (tasks, blockers, achievements, hours, next-week plan). ' +
      'Filter by week, a number of trailing weeks, team member name, project name or status. ' +
      'Returns at most 25 reports, newest first. Draft reports are never returned.',
    input_schema: {
      type: 'object',
      properties: {
        weekStart: { type: 'string', description: 'Monday of a single week, YYYY-MM-DD.' },
        weeksBack: {
          type: 'integer',
          minimum: 1,
          maximum: 12,
          description: 'Alternative to weekStart: include the last N weeks, including the current one.',
        },
        memberName: { type: 'string', description: 'Case-insensitive partial match on the team member name.' },
        projectName: { type: 'string', description: 'Case-insensitive partial match on the project name.' },
        status: { type: 'string', enum: ['SUBMITTED', 'NEEDS_CORRECTION', 'APPROVED'] },
      },
      additionalProperties: false,
    },
  },
];
