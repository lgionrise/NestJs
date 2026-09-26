import { IsBoolean, IsOptional } from 'class-validator';

export class NotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  classReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  testReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  newContentAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  doubtReplyAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @IsOptional()
  @IsBoolean()
  doNotDisturb?: boolean;
}
