import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ProcurementCompleteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectReason?: string;
}