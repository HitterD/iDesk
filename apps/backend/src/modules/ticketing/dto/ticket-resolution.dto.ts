import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sanitize } from '../../../shared/core/validators/input-sanitizer';

const DISPUTE_REASON_MAX_LENGTH = 1000;
const RATING_COMMENT_MAX_LENGTH = 1000;
const MAX_RATED_AGENTS = 20;
export const AGENT_RATING_MIN = 1;
export const AGENT_RATING_MAX = 5;

export class DisputeResolutionDto {
    @ApiProperty({ maxLength: DISPUTE_REASON_MAX_LENGTH, description: 'Why the problem is not solved yet' })
    @IsString()
    @IsNotEmpty({ message: 'Alasan sanggahan wajib diisi.' })
    @MaxLength(DISPUTE_REASON_MAX_LENGTH)
    @Sanitize({ removeHtml: true })
    reason: string;
}

export class AgentRatingItemDto {
    @ApiProperty()
    @IsUUID()
    agentId: string;

    @ApiProperty({ minimum: AGENT_RATING_MIN, maximum: AGENT_RATING_MAX })
    @IsInt()
    @Min(AGENT_RATING_MIN)
    @Max(AGENT_RATING_MAX)
    rating: number;

    @ApiPropertyOptional({ maxLength: RATING_COMMENT_MAX_LENGTH })
    @IsOptional()
    @IsString()
    @MaxLength(RATING_COMMENT_MAX_LENGTH)
    @Sanitize({ removeHtml: true })
    comment?: string;
}

export class SubmitAgentRatingsDto {
    @ApiProperty({ type: [AgentRatingItemDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(MAX_RATED_AGENTS)
    @ValidateNested({ each: true })
    @Type(() => AgentRatingItemDto)
    ratings: AgentRatingItemDto[];
}
