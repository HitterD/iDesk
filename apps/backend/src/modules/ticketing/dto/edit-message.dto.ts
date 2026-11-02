import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** New text of an edited chat message (same limit as the chat composer). */
export class EditMessageDto {
    @ApiProperty({ description: 'New message content', maxLength: 5000 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(5000)
    content: string;
}
