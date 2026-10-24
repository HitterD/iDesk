import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { EFormType } from '../entities/eform-request.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** What IT fills in when proposing access from a ticket; the requester completes the rest, picks the approver and signs. */
export class ProposeEFormFromTicketDto {
    @IsEnum(EFormType)
    formType: EFormType;

    /** Why the access is needed, prefilled as the request's reason ("alasan"). */
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    note: string;

    @Transform(trim)
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    requestedWebsites?: string;

    @Transform(trim)
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    networkPurpose?: string;

    /** Type-specific hints (e.g. proposedEmail, hostname, folderPath); unknown keys are dropped by the service. */
    @IsOptional()
    @IsObject()
    details?: Record<string, unknown>;
}
