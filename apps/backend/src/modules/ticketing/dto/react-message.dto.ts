import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { REACTION_EMOJIS } from '../services/ticket-message-reaction.service';

/** The emoji a person reacts with; only the chat's own set is accepted. */
export class ReactMessageDto {
    @ApiProperty({ enum: REACTION_EMOJIS })
    @IsString()
    @IsIn(REACTION_EMOJIS as unknown as string[])
    emoji: string;
}
