import { IsString, IsEnum, MaxLength, MinLength } from 'class-validator';
import { TargetExam } from '@prisma/client';

export class CreateCourseDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @IsEnum(TargetExam)
  targetExam: TargetExam;

  @IsString()
  @MaxLength(20)
  className: string;
}
