import { IsEmail, IsOptional, IsPhoneNumber, IsString, ValidateIf } from 'class-validator';

export class LoginDto {
  @ValidateIf((o) => !o.phone && !o.username)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email && !o.username)
  @IsPhoneNumber(undefined)
  phone?: string;

  @ValidateIf((o) => !o.email && !o.phone)
  @IsString()
  username?: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
