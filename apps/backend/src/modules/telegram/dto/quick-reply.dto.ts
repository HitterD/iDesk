import { IsString, IsOptional, IsArray, MaxLength } from 'class-validator';

export class QuickReplyDto {
    @IsString()
    @MaxLength(500)
    content: string;

    @IsString()
    @IsOptional()
    ticketId?: string;
}

export class QuickReplyTemplateDto {
    @IsString()
    @MaxLength(100)
    name: string;

    @IsString()
    @MaxLength(500)
    content: string;
}

export class SaveQuickRepliesDto {
    @IsArray()
    @IsString({ each: true })
    templates: string[];
}

export const DEFAULT_QUICK_REPLIES = [
    'Terima kasih sudah menghubungi. Saya akan segera membantu.',
    'Mohon informasikan detail lebih lanjut mengenai masalah Anda.',
    'Sudah saya cek, masalah sedang dalam proses perbaikan.',
    'Masalah sudah teratasi. Silakan cek kembali.',
    'Apakah ada kendala lain yang bisa saya bantu?',
];
