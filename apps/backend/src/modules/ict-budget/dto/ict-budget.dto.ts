import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsUUID, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { IctBudgetRequestType, IctBudgetUrgency } from '../entities/ict-budget-request.entity';

export class CreateIctBudgetDto {
    @IsEnum(IctBudgetRequestType)
    requestType: IctBudgetRequestType;

    @IsString()
    budgetCategory: string;

    @IsString()
    itemName: string;

    @IsOptional()
    @IsString()
    vendor?: string;

    @IsNumber()
    @Min(0)
    @Type(() => Number)
    estimatedAmount: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    quantity?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    renewalPeriodMonths?: number;

    @IsOptional()
    @IsDateString()
    currentExpiryDate?: string;

    @IsString()
    justification: string;

    @IsOptional()
    @IsEnum(IctBudgetUrgency)
    urgencyLevel?: IctBudgetUrgency;

    @IsOptional()
    @IsBoolean()
    requiresInstallation?: boolean;

    // Ticket creation fields
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;
}

export class ApproveIctBudgetDto {
    @IsBoolean()
    approved: boolean;

    @IsOptional()
    @IsString()
    superiorNotes?: string;
}

export class RealizeIctBudgetDto {
    @IsOptional()
    @IsString()
    purchaseOrderNumber?: string;

    @IsOptional()
    @IsString()
    invoiceNumber?: string;

    @IsOptional()
    @IsString()
    realizationNotes?: string;
}

export class UpdateIctBudgetStatusDto {
    @IsString()
    @IsEnum(['PENDING', 'APPROVED', 'REJECTED', 'PURCHASING', 'REALIZED'])
    status: string;

    @IsOptional()
    @IsString()
    notes?: string;
}
