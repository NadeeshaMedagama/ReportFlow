import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DATE_ONLY_REGEX } from '../../common/week';

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}

/** The client sends the whole conversation each time; nothing is stored server-side. */
export class ChatRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}

export class TeamSummaryRequestDto {
  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'weekStart must be YYYY-MM-DD' })
  weekStart?: string;
}
