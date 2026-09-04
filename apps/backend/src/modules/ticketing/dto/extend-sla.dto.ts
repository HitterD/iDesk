import { IsEnum, IsString, IsInt, Min, Max, IsNotEmpty, MaxLength, IsOptional, IsISO8601 } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sanitize } from '../../../shared/core/validators/input-sanitizer';
import { SlaAdjustmentReasonCategory } from '../entities/sla-adjustment.entity';

export class ExtendSlaDto {
    @ApiProperty({ enum: SlaAdjustmentReasonCategory })
    @IsEnum(SlaAdjustmentReasonCategory)
    reasonCategory: SlaAdjustmentReasonCategory;

    @ApiProperty({ description: 'Explanation of the obstacle that forced the extension' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    @Sanitize({ removeHtml: true })
    reasonText: string;

    @ApiPropertyOptional({ description: 'Extra minutes (business-hours) to add to the SLA target' })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10080)
    minutes?: number;

    @ApiPropertyOptional({ description: 'Specific new SLA target date & time in ISO 8601 format' })
    @IsOptional()
    @IsISO8601()
    newTargetDate?: string;
}

