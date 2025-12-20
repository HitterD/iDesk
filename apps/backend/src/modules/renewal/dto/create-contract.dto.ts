import { IsOptional, IsString, IsDateString, IsNumber, Min, Validate, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Custom validator to ensure startDate < endDate
@ValidatorConstraint({ name: 'isBeforeEndDate', async: false })
class IsBeforeEndDate implements ValidatorConstraintInterface {
    validate(startDate: string, args: ValidationArguments) {
        const obj = args.object as CreateContractDto;
        if (!startDate || !obj.endDate) return true;
        return new Date(startDate) < new Date(obj.endDate);
    }

    defaultMessage() {
        return 'Start date must be before end date';
    }
}

export class CreateContractDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    poNumber?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    vendorName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(0)
    contractValue?: number;

    @ApiPropertyOptional({ description: 'Contract start date (must be before end date)' })
    @IsOptional()
    @IsDateString()
    @Validate(IsBeforeEndDate)
    startDate?: string;

    @ApiPropertyOptional({ description: 'Contract end date (required for renewal reminders)' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ description: 'Contract category/type' })
    @IsOptional()
    @IsString()
    category?: string;
}
