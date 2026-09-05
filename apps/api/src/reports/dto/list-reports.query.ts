import { ReportStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { DATE_ONLY_REGEX } from '../../common/week';

export class ListReportsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  /** Managers only: filter by team member. Ignored for team members (always scoped to self). */
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  /** Exact week (Monday, YYYY-MM-DD). */
  @IsOptional()
  @Matches(DATE_ONLY_REGEX)
  weekStart?: string;

  /** Date range applied to the week start. */
  @IsOptional()
  @Matches(DATE_ONLY_REGEX)
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY_REGEX)
  to?: string;
}
