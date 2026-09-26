import { IsString, Length } from 'class-validator';

export class TwoFactorVerifySetupDto {
  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  code: string;
}
