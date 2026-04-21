import {
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    Length,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCategory } from '../domain/enums/item-category.enum';

export class CatalogRequiredFieldDto {
    @IsString() @Length(1, 80) key: string;
    @IsString() @Length(1, 160) label: string;
    @IsIn(['text', 'number', 'select']) type: 'text' | 'number' | 'select';
    @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
    @IsOptional() @IsBoolean() required?: boolean;
}

export class CreateCatalogDto {
    @IsString() @Length(1, 80) code: string;
    @IsString() @Length(1, 160) name: string;
    @IsIn(['LAPTOP', 'DESKTOP', 'MONITOR', 'ACCESSORY', 'NETWORK', 'SOFTWARE', 'OTHER']) category: ItemCategory;

    @IsOptional() @IsObject() defaultSpecs?: Record<string, unknown>;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CatalogRequiredFieldDto)
    requiredFields?: CatalogRequiredFieldDto[];

    @IsOptional() @IsBoolean() active?: boolean;
    @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}
