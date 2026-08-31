import { IsEnum, IsString, IsInt, Min, Max, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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

    @ApiProperty({ description: 'Extra minutes (business-hours) to add to the SLA target' })
    @IsInt()
    @Min(30)
    @Max(10080)
    minutes: number;
}
