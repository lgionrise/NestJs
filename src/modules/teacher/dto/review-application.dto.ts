import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ApprovalStatus } from '@prisma/client';

const REVIEWABLE_STATUSES = [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] as const;

export class ReviewApplicationDto {
  @IsIn(REVIEWABLE_STATUSES, { message: 'Status must be either APPROVED or REJECTED' })
  status: (typeof REVIEWABLE_STATUSES)[number];

  @ValidateIf((o) => o.status === ApprovalStatus.REJECTED)
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
