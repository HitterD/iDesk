import { IsString, IsOptional, IsArray, IsEnum, IsNotEmpty, MinLength, MaxLength, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleStatus, ArticleVisibility } from '../entities/article.entity';
import { Sanitize } from '../../../shared/core/validators/input-sanitizer';

export class CreateArticleDto {
    @ApiProperty({ description: 'Article title', minLength: 3, maxLength: 200 })
    @IsString()
    @IsNotEmpty()
    @MinLength(3, { message: 'Title must be at least 3 characters' })
    @MaxLength(200, { message: 'Title cannot exceed 200 characters' })
    @Sanitize({ removeHtml: true })
    title: string;

    @ApiProperty({ description: 'Article content', minLength: 10, maxLength: 100000 })
    @IsString()
    @IsNotEmpty()
    @MinLength(10, { message: 'Content must be at least 10 characters' })
    @MaxLength(100000, { message: 'Content cannot exceed 100000 characters' })
    @Sanitize()
    content: string;

    @ApiPropertyOptional({ description: 'Article category', default: 'General', maxLength: 100 })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    category?: string;

    @ApiPropertyOptional({ description: 'Article tags (max 20)', type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @ArrayMaxSize(20, { message: 'Cannot have more than 20 tags' })
    tags?: string[];

    @ApiPropertyOptional({ enum: ArticleStatus, default: ArticleStatus.DRAFT })
    @IsEnum(ArticleStatus)
    @IsOptional()
    status?: ArticleStatus;

    @ApiPropertyOptional({ enum: ArticleVisibility, default: ArticleVisibility.PUBLIC })
    @IsEnum(ArticleVisibility)
    @IsOptional()
    visibility?: ArticleVisibility;

    @ApiPropertyOptional({ description: 'Featured image URL', maxLength: 500 })
    @IsString()
    @IsOptional()
    @MaxLength(500)
    featuredImage?: string;

    @ApiPropertyOptional({ description: 'Array of image URLs in content (max 50)', type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @ArrayMaxSize(50, { message: 'Cannot have more than 50 images' })
    images?: string[];
}
