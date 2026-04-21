import { IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class DashboardAgingDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    thresholdDays?: number = 3;
}

export class DashboardRangeDto {
    @IsOptional()
    @IsIn(['30d', '90d'])
    range?: '30d' | '90d' = '30d';
}
