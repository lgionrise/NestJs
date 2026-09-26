import { IsString, IsNotEmpty, Length } from 'class-validator';

export class TwoFactorVerifyLoginDto {
  @IsString()
  @IsNotEmpty()
  mfaToken: string;

  @IsString()
  @Length(6, 8, { message: 'Code must be 6 to 8 characters' })
  code: string;
}
