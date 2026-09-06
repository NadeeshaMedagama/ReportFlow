import { TaskPriority, TaskStatus, WorkCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DATE_ONLY_REGEX } from '../../common/week';

/** One row of the "tasks completed" table. */
export class ReportTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsEnum(TaskPriority)
  priority: TaskPriority;

  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsInt()
  @Min(0)
  @Max(100)
  plannedPercent: number;

  @IsInt()
  @Min(0)
  @Max(100)
  actualPercent: number;

  @IsNumber()
  @Min(0)
  @Max(168)
  plannedHours: number;

  @IsNumber()
  @Min(0)
  @Max(168)
  actualHours: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  output?: string;
}

/** Blocker or achievement entry; at most one per list may be flagged as the key item. */
export class ReportListItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsBoolean()
  isKey?: boolean;
}

export class HoursEntryDto {
  @IsEnum(WorkCategory)
  category: WorkCategory;

  @IsNumber()
  @Min(0)
  @Max(168)
  hours: number;
}

/**
 * Full report payload. The structure is fixed: the same sections in the same
 * order for every team member. Used for both create and update (the whole
 * report is replaced on save).
 */
export class UpsertReportDto {
  /** Monday of the reporting week, YYYY-MM-DD. */
  @Matches(DATE_ONLY_REGEX, { message: 'weekStart must be a date in YYYY-MM-DD format' })
  weekStart: string;

  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReportTaskDto)
  tasks: ReportTaskDto[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  nextWeekPlan?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ReportListItemDto)
  blockers?: ReportListItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ReportListItemDto)
  achievements?: ReportListItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => HoursEntryDto)
  hours?: HoursEntryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  links?: string;
}
