import { IsBoolean, IsOptional } from 'class-validator';

export class PrivacySettingsDto {
  @IsOptional()
  @IsBoolean()
  showProfileToOtherStudents?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnLeaderboard?: boolean;

  @IsOptional()
  @IsBoolean()
  allowDataForAnalytics?: boolean;
}
