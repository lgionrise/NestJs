import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, ValidateIf } from 'class-validator';
import { OtpPurpose } from '../../otp/interfaces/otp-provider.interface';

export class SendOtpDto {
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsPhoneNumber(undefined)
  phone?: string;

  @IsEnum(OtpPurpose, { message: 'Invalid OTP purpose' })
  purpose: OtpPurpose;
}
