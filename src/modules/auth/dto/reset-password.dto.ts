import { IsEmail, IsPhoneNumber, IsString, Length, MaxLength, MinLength, Matches, ValidateIf } from 'class-validator';

export class ResetPasswordDto {
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsPhoneNumber(undefined)
  phone?: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'New password must contain at least one uppercase letter, one lowercase letter, and one number or special character',
  })
  newPassword: string;
}
