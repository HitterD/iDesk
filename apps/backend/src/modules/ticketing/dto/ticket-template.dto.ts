import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketTemplateDto {
    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    priority?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    defaultContent?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    customFields?: Record<string, any>;
}

export class UpdateTicketTemplateDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    priority?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    defaultContent?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    customFields?: Record<string, any>;
}
