import { IsInt, Max, Min } from 'class-validator';

export class SelectSlotDto {
  @IsInt()
  @Min(0)
  @Max(2)
  slotIndex!: number;
}