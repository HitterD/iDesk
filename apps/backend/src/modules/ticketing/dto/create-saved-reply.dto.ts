import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSavedReplyDto {
    @ApiProperty({ example: 'Greeting', description: 'Short title or shortcut for the reply' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: 'Hello, how can I help you today?', description: 'The full content of the reply' })
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiProperty({ example: false, description: 'If true, this reply is available to all users (Admin only)' })
    @IsOptional()
    isGlobal?: boolean;
}
