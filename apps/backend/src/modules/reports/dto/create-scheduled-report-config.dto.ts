import {
  IsString,
  IsUUID,
  IsEnum,
  IsArray,
  ArrayMinSize,
  Matches,
  IsOptional,
  MinLength,
} from 'class-validator';
import { ReportType, ScheduleType, TargetAgentCategory } from '../entities/scheduled-report-config.entity';

/**
 * DTO for creating a new scheduled report configuration.
 *
 * All fields are validated at the DTO level.
 * Additional business validation (e.g., recipients belong to site, role/category match)
 * is performed in the service layer.
 */
export class CreateScheduledReportConfigDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(ReportType)
  reportType: ReportType;

  @IsEnum(ScheduleType)
  schedule: ScheduleType;

  /**
   * Send time in 24-hour HH:mm format.
   * Examples: "07:00", "08:30", "23:45"
   */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'sendTime must be in HH:mm format (00:00 - 23:59)',
  })
  sendTime: string;

  @IsUUID()
  siteId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one recipient is required' })
  @IsUUID('4', { each: true })
  recipientUserIds: string[];

  /**
   * Only required/used when reportType is AGENT_PERFORMANCE.
   * For other report types, this may be omitted or set to null.
   */
  @IsOptional()
  @IsEnum(TargetAgentCategory)
  targetAgentCategory?: TargetAgentCategory | null;
}
