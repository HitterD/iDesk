import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SlotInput {
  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;
}

export class ScheduleProposeDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  itemIds!: string[];

  @IsUUID()
  technicianId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => SlotInput)
  slots!: SlotInput[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}