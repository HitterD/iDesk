import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class BarcodeDto {
    @IsString() @MinLength(4) @MaxLength(128)
    @Matches(/^[A-Za-z0-9\-_]+$/, { message: 'barcode alfanumerik/-/_ saja' })
    barcode: string;
}
