import { IsString, MinLength } from 'class-validator';
export class RejectRequestDto {
    @IsString() @MinLength(5)
    reason: string;
}
