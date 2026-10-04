import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsBase64,
    IsDateString,
    IsEmail,
    IsEnum,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { Sanitize } from '../../../../shared/core/validators/input-sanitizer';
import { TicketPriority } from '../../../ticketing/entities/ticket.entity';

export const IPOP_MAX_ATTACHMENTS = 5;
export const IPOP_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Same install slots as the web form (CreateTicketDto). */
const INSTALL_SLOT = /^(0[89]|1[0-1]|1[4-5]):00$/;

export class IpopRequesterDto {
    @ApiPropertyOptional({ example: '00000024', description: 'NIK (HRIS employee number). Preferred over email.' })
    @ValidateIf((o) => !o.email)
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    nik?: string;

    @ApiPropertyOptional({ example: 'budi@santos.co.id' })
    @ValidateIf((o) => !o.nik)
    @IsEmail()
    @MaxLength(255)
    email?: string;
}

export class IpopAttachmentDto {
    @ApiProperty({ example: 'screenshot.png' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    fileName: string;

    @ApiProperty({ description: 'File content, base64 (max 10 MB decoded)' })
    @IsBase64()
    contentBase64: string;
}

export class IpopCreateTicketDto {
    @ApiProperty({ example: 'IPOP-REQ-2026-000123', description: "iPop's own id; a retry with the same value returns the same ticket" })
    @IsString()
    @Matches(/^[A-Za-z0-9._:\-/]{1,100}$/, { message: 'externalRef: 1-100 chars of letters, digits and . _ : - /' })
    externalRef: string;

    @ApiProperty({ example: 'it-support', description: 'Module slug from GET /integrations/ipop/modules' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    module: string;

    @ApiPropertyOptional({ example: 'NETWORK', description: 'One of the module categories; required for it-support' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    category?: string;

    @ApiProperty({ enum: TicketPriority, example: TicketPriority.MEDIUM })
    @IsEnum(TicketPriority)
    priority: TicketPriority;

    @ApiProperty({ example: 'Printer lantai 2 tidak bisa print' })
    @IsString()
    @MinLength(5)
    @MaxLength(200)
    @Sanitize({ removeHtml: true })
    title: string;

    @ApiProperty({ example: 'Printer HP lantai 2 error paper jam sejak pagi.' })
    @IsString()
    @MinLength(3)
    @MaxLength(5000)
    @Sanitize({ removeHtml: true })
    description: string;

    @ApiProperty({ type: IpopRequesterDto })
    @ValidateNested()
    @Type(() => IpopRequesterDto)
    requester: IpopRequesterDto;

    @ApiPropertyOptional({ description: 'Required when priority is CRITICAL' })
    @ValidateIf((o) => o.priority === TicketPriority.CRITICAL)
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    @Sanitize({ removeHtml: true })
    criticalReason?: string;

    @ApiPropertyOptional({ example: 'Laptop' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    device?: string;

    @ApiPropertyOptional({ example: 'Windows' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    software?: string;

    // --- Hardware installation (category HARDWARE_INSTALLATION on it-support) ---

    @ApiPropertyOptional({ example: '2026-10-08', description: 'Installation date (YYYY-MM-DD)' })
    @ValidateIf((o) => o.category === 'HARDWARE_INSTALLATION')
    @IsDateString()
    scheduledDate?: string;

    @ApiPropertyOptional({ example: '09:00', description: 'Installation slot: 08-11:00 or 14-15:00' })
    @ValidateIf((o) => o.category === 'HARDWARE_INSTALLATION')
    @Matches(INSTALL_SLOT, { message: 'scheduledTime must be 08:00-11:00 or 14:00-15:00 on the hour' })
    scheduledTime?: string;

    @ApiPropertyOptional({ example: 'PC' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    @Sanitize({ removeHtml: true })
    hardwareType?: string;

    @ApiPropertyOptional({ type: [IpopAttachmentDto], description: `Up to ${IPOP_MAX_ATTACHMENTS} files, 10 MB each` })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(IPOP_MAX_ATTACHMENTS)
    @ValidateNested({ each: true })
    @Type(() => IpopAttachmentDto)
    attachments?: IpopAttachmentDto[];
}

export class IpopTicketQueryDto {
    @ApiPropertyOptional({ description: 'Look up by iPop reference' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    externalRef?: string;

    @ApiPropertyOptional({ description: "All iPop tickets of this requester's NIK (newest first)" })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    nik?: string;

    @ApiPropertyOptional({ enum: ['open', 'all'], default: 'all' })
    @IsOptional()
    @IsIn(['open', 'all'])
    state?: 'open' | 'all';
}
