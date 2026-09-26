import { IsBoolean } from 'class-validator';

export class VisibilitySettingsDto {
  @IsBoolean()
  isVisible: boolean;
}
