import { IsDateString, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateItemDto {
    @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
    actualCost?: number;
    @IsOptional() @IsString() @Length(1, 255) vendor?: string;
    @IsOptional() @IsString() @Length(1, 100) invoiceNumber?: string;
    @IsOptional() @IsDateString() invoiceDate?: string;
    @IsOptional() @IsString() notes?: string;
}
