import { IsOptional, IsArray, IsNumber, IsString, IsBoolean, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBusinessHoursDto {
    @ApiPropertyOptional({ description: 'Configuration name' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({
        description: 'Work days (0=Sunday, 6=Saturday)',
        example: [1, 2, 3, 4, 5],
        type: [Number],
    })
    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    workDays?: number[];

    @ApiPropertyOptional({
        description: 'Start time in minutes from midnight (e.g., 480 = 8:00 AM)',
        minimum: 0,
        maximum: 1440,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1440)
    startTime?: number;

    @ApiPropertyOptional({
        description: 'End time in minutes from midnight (e.g., 1020 = 5:00 PM)',
        minimum: 0,
        maximum: 1440,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1440)
    endTime?: number;

    @ApiPropertyOptional({ description: 'Timezone', example: 'Asia/Jakarta' })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiPropertyOptional({
        description: 'Holiday dates (YYYY-MM-DD format)',
        example: ['2025-01-01', '2025-12-25'],
        type: [String],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    holidays?: string[];
}

export class AddHolidayDto {
    @ApiPropertyOptional({ description: 'Holiday date in YYYY-MM-DD format' })
    @IsString()
    date: string;

    @ApiPropertyOptional({ description: 'Holiday name/description' })
    @IsOptional()
    @IsString()
    name?: string;
}
