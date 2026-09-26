import { IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ApprovalStatus } from '@prisma/client';

export class ReviewApplicationDto {
  @IsEnum(ApprovalStatus, { message: 'Status must be either APPROVED or REJECTED' })
  status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED;

  @ValidateIf((o) => o.status === ApprovalStatus.REJECTED)
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
