import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsEnum,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
} from 'class-validator';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { ItemCategory } from '../domain/enums/item-category.enum';

export class ListRequestsDto {
    @IsOptional()
    @IsArray()
    @IsEnum(RequestStatus, { each: true })
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    status?: RequestStatus[];

    @IsOptional()
    @IsArray()
    @IsEnum(ItemCategory, { each: true })
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    category?: ItemCategory[];

    @IsOptional()
    @IsUUID()
    siteId?: string;

    @IsOptional()
    @IsUUID()
    requesterId?: string;

    @IsOptional()
    @IsIn(['my', 'all'])
    scope?: 'my' | 'all';

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    pageSize?: number = 20;
}
