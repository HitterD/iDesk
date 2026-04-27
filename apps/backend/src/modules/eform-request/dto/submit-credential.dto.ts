import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SubmitCredentialDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  vpnServer?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
