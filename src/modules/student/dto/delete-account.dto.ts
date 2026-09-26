import { IsString, IsNotEmpty } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  confirmationText: string; // must equal "DELETE MY ACCOUNT"
}
