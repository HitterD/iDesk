import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemDecisionInput {
  @IsUUID()
  itemId!: string;

  @IsEnum(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';
}

export class ProcurementDecisionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDecisionInput)
  decisions!: ItemDecisionInput[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}