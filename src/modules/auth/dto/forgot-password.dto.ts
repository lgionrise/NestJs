import { IsEmail, IsPhoneNumber, ValidateIf } from 'class-validator';

export class ForgotPasswordDto {
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsPhoneNumber(undefined)
  phone?: string;
}
