import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { SaveDraftDto } from '../dto/draft.dto';
import { SubmitResponseDto } from '../dto/submit.dto';
import { CsiDraftService } from '../services/csi-draft.service';
import { CsiRespondentService } from '../services/csi-respondent.service';
import { CsiSelfResultService } from '../services/csi-self-result.service';

type CsiMeRequest = { user: { userId: string } };
const CSI_ID_PIPE = new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException('ID harus berupa UUID'),
});
// Only the id comes from the token; the service re-reads site and active state from the database.
const toRespondent = (req: CsiMeRequest) => ({ id: req.user.userId });

@Controller('csi/me')
@UseGuards(JwtAuthGuard)
export class CsiMeController {
    constructor(
        private readonly respondent: CsiRespondentService,
        private readonly selfResults: CsiSelfResultService,
        private readonly drafts: CsiDraftService,
    ) { }

    /** "Hasil penilaian saya": anonymous results about the signed-in account (live, from 3 raters on). */
    @Get('results')
    myResults(@Req() req: CsiMeRequest) {
        return this.selfResults.list(req.user.userId);
    }

    @Get('active')
    async listActive(@Req() req: CsiMeRequest) {
        const periods = await this.respondent.listActive(toRespondent(req));
        return this.drafts.withDraftFlags(req.user.userId, periods);
    }

    @Get('periods/:id')
    async getForm(@Req() req: CsiMeRequest, @Param('id', CSI_ID_PIPE) id: string) {
        const form = await this.respondent.getForm(toRespondent(req), id);
        const draft = form.submittedAt ? null : await this.drafts.getForForm(id, req.user.userId);
        return { ...form, draft };
    }

    @Put('periods/:id/draft')
    saveDraft(@Req() req: CsiMeRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: SaveDraftDto) {
        return this.drafts.save(toRespondent(req), id, dto);
    }

    @Post('periods/:id/responses')
    async submit(@Req() req: CsiMeRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: SubmitResponseDto) {
        const result = await this.respondent.submit(toRespondent(req), id, dto);
        await this.drafts.clear(req.user.userId, id);
        return result;
    }
}
