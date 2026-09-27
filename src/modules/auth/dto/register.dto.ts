import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Role } from '@prisma/client';

const PUBLIC_REGISTERABLE_ROLES = [Role.STUDENT, Role.TEACHER] as const;

export class RegisterDto {
  @ValidateIf((o) => !o.phone)
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsPhoneNumber(undefined, { message: 'Please provide a valid phone number' })
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number or special character',
  })
  password: string;

  @IsOptional()
  @IsEnum(PUBLIC_REGISTERABLE_ROLES, {
    message: 'Role must be either STUDENT or TEACHER',
  })
  role?: (typeof PUBLIC_REGISTERABLE_ROLES)[number];
}
