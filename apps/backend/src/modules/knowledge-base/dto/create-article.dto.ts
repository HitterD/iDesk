import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleStatus, ArticleVisibility } from '../entities/article.entity';

export class CreateArticleDto {
    @ApiProperty({ description: 'Article title' })
    @IsString()
    title: string;

    @ApiProperty({ description: 'Article content' })
    @IsString()
    content: string;

    @ApiPropertyOptional({ description: 'Article category', default: 'General' })
    @IsString()
    @IsOptional()
    category?: string;

    @ApiPropertyOptional({ description: 'Article tags', type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @ApiPropertyOptional({ enum: ArticleStatus, default: ArticleStatus.DRAFT })
    @IsEnum(ArticleStatus)
    @IsOptional()
    status?: ArticleStatus;

    @ApiPropertyOptional({ enum: ArticleVisibility, default: ArticleVisibility.PUBLIC })
    @IsEnum(ArticleVisibility)
    @IsOptional()
    visibility?: ArticleVisibility;

    @ApiPropertyOptional({ description: 'Featured image URL' })
    @IsString()
    @IsOptional()
    featuredImage?: string;

    @ApiPropertyOptional({ description: 'Array of image URLs in content', type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    images?: string[];
}
