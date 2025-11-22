import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ReplyMessageDto {
    @IsUUID()
    @IsNotEmpty()
    ticketId: string;

    @IsString()
    @IsNotEmpty()
    content: string;
}
