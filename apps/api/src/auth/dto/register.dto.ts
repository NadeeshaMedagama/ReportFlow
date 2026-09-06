import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).+$/;
export const PASSWORD_MESSAGE = 'Password must be at least 8 characters and contain a letter and a number';

export class RegisterDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string;
}
