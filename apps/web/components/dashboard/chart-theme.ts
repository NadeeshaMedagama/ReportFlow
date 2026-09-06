/**
 * Chart colours. Categorical hues are assigned in a FIXED order per entity
 * (member index, category index) so a colour always means the same thing;
 * status colours are reserved for states and never reused for series.
 * Palette values come from a validated colour-blind-safe default set.
 */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

export const STATUS_COLORS: Record<string, string> = {
  APPROVED: '#0ca30c',
  SUBMITTED: '#2a78d6',
  NEEDS_CORRECTION: '#fab219',
  DRAFT: '#94a3b8',
  NOT_STARTED: '#ec835a',
};

export const WORK_CATEGORY_ORDER = ['DEVELOPMENT', 'TESTING', 'MEETINGS', 'DOCUMENTATION', 'DESIGN', 'SUPPORT', 'OTHER'];

export const AXIS_TICK = { fill: '#64748b', fontSize: 12 };
export const GRID_STROKE = '#e2e8f0';
export const TOOLTIP_STYLE = { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(15,23,42,.08)' };

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}
