import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { DATE_ONLY_REGEX } from '../../common/week';

export class WeekQueryDto {
  /** Monday of the week (YYYY-MM-DD). Defaults to the current week. */
  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'weekStart must be YYYY-MM-DD' })
  weekStart?: string;
}

export class WindowQueryDto {
  /** Number of trailing weeks (including the current one) to analyse. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(26)
  weeks: number = 8;
}

export class ActivityQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export const SECTION_KEYS = ['BLOCKERS', 'ACHIEVEMENTS', 'NEXT_WEEK', 'TASKS'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export class SectionQueryDto extends WeekQueryDto {
  @IsIn(SECTION_KEYS)
  section: SectionKey;
}
