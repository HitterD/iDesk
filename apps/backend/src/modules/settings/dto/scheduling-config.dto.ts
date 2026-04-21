import { IsOptional, IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTimeSlotsDto {
    @ApiProperty({
        description: 'Array of time slots in HH:mm format',
        example: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00'],
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    timeSlots: string[];
}

export class UpdateHardwareTypesDto {
    @ApiProperty({
        description: 'Array of hardware types',
        example: ['PC', 'IP-Phone', 'Printer', 'Router'],
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    hardwareTypes: string[];
}

export interface SchedulingConfig {
    timeSlots: string[];
    hardwareTypes: string[];
}
