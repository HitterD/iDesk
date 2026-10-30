import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class IpopZoomBookingQueryDto {
    @ApiProperty({ description: 'NIK of the user whose calendar to fill (booker or invited participant)' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    nik: string;

    @ApiProperty({ example: '2026-10-01', description: 'First day, WIB (YYYY-MM-DD)' })
    @Matches(ISO_DATE, { message: 'from must be YYYY-MM-DD' })
    from: string;

    @ApiProperty({ example: '2026-10-31', description: 'Last day, WIB (YYYY-MM-DD), at most 92 days after from' })
    @Matches(ISO_DATE, { message: 'to must be YYYY-MM-DD' })
    to: string;
}
