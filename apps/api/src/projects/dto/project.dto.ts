import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ToBoolean } from '../../common/transforms';

export class CreateProjectDto {
  @IsString()
  @Length(2, 80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Optional initial team member assignment. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  memberIds?: string[];
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  memberIds?: string[];
}

export class SetProjectMembersDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  memberIds: string[];
}

export class ListProjectsQueryDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeInactive?: boolean;
}
