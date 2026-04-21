import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEmail,
    IsBoolean,
    IsInt,
    Min,
    Max,
    IsHexColor,
    IsEnum,
    MaxLength,
} from 'class-validator';
import { ZoomAccountType } from '../enums/booking-status.enum';

export class CreateZoomAccountDto {
    @ApiProperty({ description: 'Account display name', example: 'Zoom 1' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    name: string;

    @ApiProperty({ description: 'Zoom account email' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiPropertyOptional({ description: 'Zoom API User ID' })
    @IsString()
    @IsOptional()
    zoomUserId?: string;

    @ApiPropertyOptional({ description: 'Account type', enum: ZoomAccountType })
    @IsEnum(ZoomAccountType)
    @IsOptional()
    accountType?: ZoomAccountType;

    @ApiPropertyOptional({ description: 'Display order (1-10)', example: 1 })
    @IsInt()
    @Min(1)
    @Max(20)
    @IsOptional()
    displayOrder?: number;

    @ApiPropertyOptional({ description: 'Display color (hex)', example: '#3B82F6' })
    @IsHexColor()
    @IsOptional()
    colorHex?: string;

    @ApiPropertyOptional({ description: 'Account description' })
    @IsString()
    @IsOptional()
    @MaxLength(500)
    description?: string;
}

export class UpdateZoomAccountDto {
    @ApiPropertyOptional({ description: 'Account display name' })
    @IsString()
    @IsOptional()
    @MaxLength(50)
    name?: string;

    @ApiPropertyOptional({ description: 'Zoom account email' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ description: 'Zoom API User ID' })
    @IsString()
    @IsOptional()
    zoomUserId?: string;

    @ApiPropertyOptional({ description: 'Display order' })
    @IsInt()
    @Min(1)
    @Max(20)
    @IsOptional()
    displayOrder?: number;

    @ApiPropertyOptional({ description: 'Display color (hex)' })
    @IsHexColor()
    @IsOptional()
    colorHex?: string;

    @ApiPropertyOptional({ description: 'Account active status' })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'Account description' })
    @IsString()
    @IsOptional()
    @MaxLength(500)
    description?: string;
}
