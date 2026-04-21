import { IsArray, IsOptional, IsString, IsUrl, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CommentAttachmentDto {
    @IsUrl() url: string;
    @IsString() name: string;
    @IsString() mimeType: string;
    @IsOptional() size?: number;
}

export class CreateCommentDto {
    @IsString() @MinLength(1)
    body: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CommentAttachmentDto)
    attachments?: CommentAttachmentDto[];
}
