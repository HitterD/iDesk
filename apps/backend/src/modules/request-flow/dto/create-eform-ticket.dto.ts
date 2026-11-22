import { OmitType } from '@nestjs/swagger';
import { IsISO8601, IsOptional, Matches } from 'class-validator';
import { CreateEFormRequestDto } from '../../eform-request/dto/create-eform-request.dto';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Tanggal harus berformat YYYY-MM-DD';

/**
 * The e-form request as the unified ticket form sends it. IT picks the approval route (and any GM) during review, so
 * there is no GM pick and `managerId` (inherited, optional) is only the requester's proposal. Proposals drafted from a
 * ticket (`draftId`) are not completed through this form.
 */
export class CreateEformTicketDto extends OmitType(CreateEFormRequestDto, ['gmApproverId', 'draftId'] as const) {
    @Matches(ISO_DAY, { message: DATE_MESSAGE })
    @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
    startDate: string;

    /** Left out for permanent access (Website, Email, Synology NAS). */
    @IsOptional()
    @Matches(ISO_DAY, { message: DATE_MESSAGE })
    @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
    endDate?: string;
}
