import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  IsUrl,
  Matches,
} from 'class-validator';
import { Language, TargetExam } from '@prisma/client';

export class SetupProfileDto {
  @IsString()
  @MaxLength(100)
  fullName: string;

  @IsOptional()
  @IsUrl({}, { message: 'Photo URL must be a valid URL' })
  photoUrl?: string;

  @IsString()
  @MaxLength(20)
  className: string;

  @IsOptional()
  @IsEnum(TargetExam)
  targetExam?: TargetExam;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  guardianName?: string;

  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Guardian phone must be a valid phone number' })
  guardianPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  schoolName?: string;
}
