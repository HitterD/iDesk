import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ProcurementCompleteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectReason?: string;

  /** Free note of whoever bought the goods; kept on the PROCUREMENT_COMPLETED activity. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
