import { Type } from 'class-transformer';
import {
    ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

/** The request flows ICT can pick for a ticket, the same three the Hardware Request wizard offers. */
export enum HardwareRequestType {
    BUDGET_ANNUAL = 'BUDGET_ANNUAL',
    NON_BUDGET = 'NON_BUDGET',
    HARDWARE_INSTALLATION = 'HARDWARE_INSTALLATION',
}

/** Justification prefix that carries the flow (the wizard's convention; the backend reads the installation one). */
export const REQUEST_TYPE_PREFIX: Record<HardwareRequestType, string> = {
    [HardwareRequestType.BUDGET_ANNUAL]: '[BUDGET TAHUNAN]',
    [HardwareRequestType.NON_BUDGET]: '[NON-BUDGET]',
    [HardwareRequestType.HARDWARE_INSTALLATION]: '[PENJADWALAN PEMASANGAN]',
};

const MAX_ITEMS = 20;
const MAX_QUANTITY = 20;

export class ProposeItemDto {
    @IsUUID()
    catalogId: string;

    @IsInt()
    @Min(1)
    @Max(MAX_QUANTITY)
    quantity: number;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    notes?: string;
}

export class ProposeFromTicketDto {
    @IsEnum(HardwareRequestType)
    requestType: HardwareRequestType;

    @IsString()
    @MinLength(5)
    @MaxLength(2000)
    justification: string;

    @IsString()
    @IsOptional()
    @MaxLength(120)
    division?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(MAX_ITEMS)
    @ValidateNested({ each: true })
    @Type(() => ProposeItemDto)
    items: ProposeItemDto[];
}
