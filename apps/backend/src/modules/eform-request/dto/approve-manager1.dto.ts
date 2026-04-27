import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ApproveManagerDto {
  @IsString()
  @IsOptional()
  signatureData: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @IsString()
  @IsNotEmpty()
  action: 'APPROVE' | 'REJECT';
}
