import { IsEmail, IsOptional, IsPhoneNumber, IsString, ValidateIf } from 'class-validator';

export class LoginDto {
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsPhoneNumber(undefined)
  phone?: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
