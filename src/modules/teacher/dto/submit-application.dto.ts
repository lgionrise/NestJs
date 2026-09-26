import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsUrl,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class SubmitApplicationDto {
  @IsString()
  @MaxLength(100)
  fullName: string;

  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @IsString()
  @MaxLength(1000)
  bio: string;

  @IsString()
  @MaxLength(500)
  qualifications: string;

  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  subjects: string[];

  @IsOptional()
  @IsUrl()
  videoIntroUrl?: string;

  @IsOptional()
  @IsUrl()
  youtubeUrl?: string;

  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;
}
