import {
    ArrayMinSize,
    IsArray,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequestItemDto {
    @IsUUID()
    catalogId: string;

    @IsInt()
    @Min(1)
    quantity: number;

    @IsObject()
    @IsOptional()
    customFields?: Record<string, unknown>;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class CreateRequestDto {
    @IsUUID()
    siteId: string;

    @IsUUID()
    @IsOptional()
    recipientId?: string;

    @IsString()
    @IsOptional()
    recipientName?: string;

    @IsString()
    @IsOptional()
    division?: string;

    @IsString()
    @MinLength(1)
    justification: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateRequestItemDto)
    items: CreateRequestItemDto[];
}
