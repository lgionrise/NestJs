import { IsString } from 'class-validator';

export class TwoFactorDisableDto {
  @IsString()
  password: string;
}
