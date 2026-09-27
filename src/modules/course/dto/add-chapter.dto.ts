import { IsString, IsInt, Min, MaxLength, IsArray, IsOptional } from 'class-validator';

export class AddChapterDto {
  @IsString()
  @MaxLength(150)
  title: string;

  @IsInt()
  @Min(0)
  orderIndex: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];
}
