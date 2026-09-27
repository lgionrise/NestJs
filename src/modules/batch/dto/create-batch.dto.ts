import {
  IsString,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  IsOptional,
  IsDateString,
  MaxLength,
  ValidateNested,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Language } from '@prisma/client';

class ScheduleEntryDto {
  @IsEnum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsString()
  subject?: string;
}

export class CreateBatchDto {
  @IsUUID()
  courseId: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsUUID()
  teacherUserId: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @IsInt()
  @Min(0)
  priceInPaise: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountedPriceInPaise?: number;

  @IsInt()
  @Min(1)
  validityDays: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScheduleEntryDto)
  schedules: ScheduleEntryDto[];
}
