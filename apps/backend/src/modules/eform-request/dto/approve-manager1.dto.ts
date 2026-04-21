import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class ApproveManager1Dto {
  @IsString()
  @IsNotEmpty()
  signatureData: string;

  @IsUUID()
  @IsOptional()
  nextApproverId?: string;
}
