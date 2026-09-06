import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReviewDecision {
  APPROVE = 'APPROVE',
  REQUEST_CHANGES = 'REQUEST_CHANGES',
}

export class ReviewReportDto {
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  /** Required when requesting changes, optional when approving. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
