import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSavedReplyDto {
    @ApiProperty({ example: 'Greeting', description: 'Short title for the reply', required: false })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiProperty({ example: 'Hello {user_name}, how can I help you today?', description: 'The full content of the reply', required: false })
    @IsOptional()
    @IsString()
    content?: string;

    @ApiProperty({ example: '/hi', description: 'Shortcut keyword for slash command autocomplete (e.g. /hi)', required: false })
    @IsOptional()
    @IsString()
    shortcut?: string;

    @ApiProperty({ example: 'General', description: 'Category of the canned response', required: false })
    @IsOptional()
    @IsString()
    category?: string;
}
