import { IsString, IsOptional, IsUUID, IsDateString, IsObject } from 'class-validator';

export class CreateAccessRequestDto {
    @IsUUID()
    accessTypeId: string;

    @IsOptional()
    @IsString()
    requestedAccess?: string;

    @IsString()
    purpose: string;

    @IsOptional()
    @IsObject()
    customFormData?: Record<string, any>;

    @IsOptional()
    @IsDateString()
    validFrom?: string;

    @IsOptional()
    @IsDateString()
    validUntil?: string;

    // Ticket fields
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;
}

export class VerifyAccessRequestDto {
    @IsString()
    verificationNotes: string;
}

export class CreateAccessCredentialsDto {
    @IsString()
    accessCredentials: string;
}

export class RejectAccessRequestDto {
    @IsString()
    rejectionReason: string;
}
