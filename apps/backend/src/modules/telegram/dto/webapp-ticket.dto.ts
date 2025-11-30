import { IsString, IsOptional, IsEnum, MinLength, MaxLength, IsArray } from 'class-validator';

export class WebAppTicketDto {
    @IsString()
    @MinLength(5)
    @MaxLength(200)
    title: string;

    @IsString()
    @MinLength(10)
    @MaxLength(5000)
    description: string;

    @IsString()
    @IsOptional()
    category?: string;

    @IsString()
    @IsOptional()
    priority?: string;

    @IsArray()
    @IsOptional()
    attachments?: string[];

    @IsString()
    initData: string; // Telegram Web App init data for validation
}

export class WebAppTicketResponseDto {
    success: boolean;
    ticketId?: string;
    ticketNumber?: string;
    message?: string;
}
