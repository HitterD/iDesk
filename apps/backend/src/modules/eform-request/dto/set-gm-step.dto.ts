import { IsBoolean, IsOptional, IsUUID, ValidateIf } from 'class-validator';

/** ICT decides whether the GM approves this request, and who. */
export class SetGmStepDto {
  @IsBoolean()
  requiresGm: boolean;

  /** Null (or absent) leaves the GM open: ICT then uploads the paper-signed form instead. */
  @ValidateIf((dto: SetGmStepDto) => dto.gmApproverId !== null && dto.gmApproverId !== undefined)
  @IsUUID()
  @IsOptional()
  gmApproverId?: string | null;
}
