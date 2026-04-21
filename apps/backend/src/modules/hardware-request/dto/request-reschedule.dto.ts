import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestRescheduleDto {
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}