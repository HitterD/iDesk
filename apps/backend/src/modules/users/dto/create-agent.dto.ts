import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateAgentDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}
