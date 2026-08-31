import { IsEnum, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Sanitize } from '../../../shared/core/validators/input-sanitizer';
import { HandlingTeam } from '../entities/ticket.entity';

export class ForwardTicketDto {
    @ApiProperty({ enum: HandlingTeam })
    @IsEnum(HandlingTeam)
    targetTeam: HandlingTeam;

    @ApiProperty({ description: 'Why the ticket is forwarded to the other team' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    @Sanitize({ removeHtml: true })
    reason: string;
}
