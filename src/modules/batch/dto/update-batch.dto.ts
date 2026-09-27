import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateBatchDto } from './create-batch.dto';

export class UpdateBatchDto extends PartialType(
  OmitType(CreateBatchDto, ['schedules'] as const),
) {}
