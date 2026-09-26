import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString, Length, ValidateIf } from 'class-validator';
import { OtpPurpose } from '../../otp/interfaces/otp-provider.interface';

export class VerifyOtpDto {
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsPhoneNumber(undefined)
  phone?: string;

  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}
