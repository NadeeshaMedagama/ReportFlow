import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../../auth/dto/register.dto';

/** Admin "invite": creates an account with a role and a temporary password. */
export class CreateUserDto {
  @IsString()
  @Length(2, 80)
  name: string;

  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsString()
  @MinLength(8, { message: PASSWORD_MESSAGE })
  @MaxLength(72)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string;
}
