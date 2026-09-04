import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTicketReminderDto {
    @ApiProperty({
        description: 'ISO-8601 string of the date and time when the reminder should be sent',
        example: '2026-09-03T08:00:00.000Z',
    })
    @IsNotEmpty({ message: 'Tanggal dan jam pengingat wajib diisi' })
    @IsDateString({}, { message: 'Format tanggal dan jam pengingat tidak valid' })
    remindAt: string;

    @ApiPropertyOptional({
        description: 'Optional note or memo to include in the reminder email',
        example: 'Follow up perbaikan bug Oracle invoice dengan vendor',
        maxLength: 500,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500, { message: 'Catatan pengingat maksimal 500 karakter' })
    note?: string;
}
