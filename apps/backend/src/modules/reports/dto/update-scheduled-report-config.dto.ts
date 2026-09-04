import {
  IsString,
  IsUUID,
  IsEnum,
  IsArray,
  ArrayMinSize,
  Matches,
  IsOptional,
  MinLength,
  IsBoolean,
} from 'class-validator';
import { ReportType, ScheduleType, TargetAgentCategory } from '../entities/scheduled-report-config.entity';

/**
 * DTO for updating an existing scheduled report configuration.
 *
 * All fields are optional (partial update).
 * Business validation (site/recipient/category consistency) happens in the service.
 */
export class UpdateScheduledReportConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(ReportType)
  reportType?: ReportType;

  @IsOptional()
  @IsEnum(ScheduleType)
  schedule?: ScheduleType;

  /**
   * Send time in 24-hour HH:mm format.
   */
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'sendTime must be in HH:mm format (00:00 - 23:59)',
  })
  sendTime?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one recipient is required' })
  @IsUUID('4', { each: true })
  recipientUserIds?: string[];

  @IsOptional()
  @IsEnum(TargetAgentCategory)
  targetAgentCategory?: TargetAgentCategory | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
