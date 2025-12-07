import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sanitize } from '../../../shared/core/validators/input-sanitizer';

export class ReplyMessageDto {
    @ApiProperty({ description: 'Ticket ID' })
    @IsUUID()
    @IsNotEmpty()
    ticketId: string;

    @ApiProperty({ description: 'Message content', minLength: 1, maxLength: 10000 })
    @IsString()
    @IsNotEmpty()
    @MinLength(1, { message: 'Message cannot be empty' })
    @MaxLength(10000, { message: 'Message cannot exceed 10000 characters' })
    @Sanitize()
    content: string;

    @ApiPropertyOptional({ description: 'Attachment file paths' })
    @IsOptional()
    @IsArray()
    files?: string[];

    @ApiPropertyOptional({ description: 'Mentioned user IDs' })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    mentionedUserIds?: string[];

    @ApiPropertyOptional({ description: 'Mark as internal note (only visible to agents/admins)' })
    @IsOptional()
    @IsBoolean()
    isInternal?: boolean;
}
