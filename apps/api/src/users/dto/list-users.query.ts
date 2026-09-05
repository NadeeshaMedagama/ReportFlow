import { Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ToBoolean } from '../../common/transforms';

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeInactive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}
