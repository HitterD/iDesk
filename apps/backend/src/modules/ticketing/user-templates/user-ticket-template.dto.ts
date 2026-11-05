import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Sanitize } from '../../../shared/core/validators/input-sanitizer';
import { TicketPriority } from '../entities/ticket.entity';
import {
    USER_TEMPLATE_LABEL_MAX, USER_TEMPLATE_LABEL_MIN, USER_TEMPLATE_PRIORITIES, USER_TEMPLATE_TICKET_TYPES, UserTemplateTicketType,
} from './user-ticket-template.constants';

const emptyToNull = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? null : value);

/** Same limits as CreateTicketDto, so a saved template always makes a valid ticket. */
export class CreateUserTicketTemplateDto {
    @ApiProperty({ enum: USER_TEMPLATE_TICKET_TYPES })
    @IsIn(USER_TEMPLATE_TICKET_TYPES)
    ticketType: UserTemplateTicketType;

    @ApiProperty({ minLength: USER_TEMPLATE_LABEL_MIN, maxLength: USER_TEMPLATE_LABEL_MAX })
    @IsString()
    @Sanitize({ removeHtml: true })
    @MinLength(USER_TEMPLATE_LABEL_MIN, { message: `Nama template minimal ${USER_TEMPLATE_LABEL_MIN} karakter` })
    @MaxLength(USER_TEMPLATE_LABEL_MAX, { message: `Nama template maksimal ${USER_TEMPLATE_LABEL_MAX} karakter` })
    label: string;

    @ApiProperty({ maxLength: 200 })
    @IsString()
    @IsNotEmpty()
    @Sanitize({ removeHtml: true })
    @MinLength(5, { message: 'Judul minimal 5 karakter' })
    @MaxLength(200)
    title: string;

    @ApiProperty({ maxLength: 5000 })
    @IsString()
    @IsNotEmpty()
    @Sanitize()
    @MinLength(3, { message: 'Detail minimal 3 karakter' })
    @MaxLength(5000)
    description: string;

    @ApiProperty({ enum: USER_TEMPLATE_PRIORITIES })
    @IsIn(USER_TEMPLATE_PRIORITIES)
    priority: TicketPriority;

    @ApiPropertyOptional({ maxLength: 100 })
    @IsOptional()
    @Transform(emptyToNull)
    @IsString()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    category?: string | null;

    @ApiPropertyOptional({ maxLength: 100 })
    @IsOptional()
    @Transform(emptyToNull)
    @IsString()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    device?: string | null;

    @ApiPropertyOptional({ maxLength: 100 })
    @IsOptional()
    @Transform(emptyToNull)
    @IsString()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    software?: string | null;
}

/** The form a template belongs to never changes; everything else can. */
export class UpdateUserTicketTemplateDto extends PartialType(OmitType(CreateUserTicketTemplateDto, ['ticketType'] as const)) {}
