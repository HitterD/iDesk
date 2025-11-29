import { IsEnum, IsNotEmpty, IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketSource } from '../entities/ticket.entity';
import { Sanitize } from '../../../shared/core/validators/input-sanitizer';
import { NoSqlInjection } from '../../../shared/core/validators/common.validators';

export class CreateTicketDto {
    @ApiProperty({ example: 'Cannot login to system', minLength: 5, maxLength: 200 })
    @IsString()
    @IsNotEmpty()
    @MinLength(5, { message: 'Title must be at least 5 characters' })
    @MaxLength(200, { message: 'Title cannot exceed 200 characters' })
    @Sanitize({ removeHtml: true })
    @NoSqlInjection()
    title: string;

    @ApiProperty({ example: 'I am unable to login since this morning...', minLength: 10, maxLength: 5000 })
    @IsString()
    @IsNotEmpty()
    @MinLength(10, { message: 'Description must be at least 10 characters' })
    @MaxLength(5000, { message: 'Description cannot exceed 5000 characters' })
    @Sanitize()
    description: string;

    @ApiProperty({ enum: TicketPriority, example: 'MEDIUM' })
    @IsEnum(TicketPriority, { message: 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL' })
    @IsNotEmpty()
    priority: TicketPriority;

    @ApiPropertyOptional({ example: 'Software', maxLength: 100 })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    @Transform(({ value }) => value || undefined)
    category?: string;

    @ApiPropertyOptional({ enum: TicketSource, example: 'WEB' })
    @IsEnum(TicketSource)
    @IsOptional()
    source?: TicketSource;

    @ApiPropertyOptional({ example: 'Laptop Dell XPS 15', maxLength: 100 })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    @Transform(({ value }) => value || undefined)
    device?: string;

    @ApiPropertyOptional({ example: 'Microsoft Office 365', maxLength: 100 })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    @Transform(({ value }) => value || undefined)
    software?: string;
}
