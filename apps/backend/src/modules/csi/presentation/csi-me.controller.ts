import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { SubmitResponseDto } from '../dto/submit.dto';
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
    constructor(private readonly respondent: CsiRespondentService, private readonly selfResults: CsiSelfResultService) { }

    /** "Hasil penilaian saya": anonymous results about the signed-in account (live, from 3 raters on). */
    @Get('results')
    myResults(@Req() req: CsiMeRequest) {
        return this.selfResults.list(req.user.userId);
    }

    @Get('active')
    listActive(@Req() req: CsiMeRequest) {
        return this.respondent.listActive(toRespondent(req));
    }

    @Get('periods/:id')
    getForm(@Req() req: CsiMeRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.respondent.getForm(toRespondent(req), id);
    }

    @Post('periods/:id/responses')
    submit(@Req() req: CsiMeRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: SubmitResponseDto) {
        return this.respondent.submit(toRespondent(req), id, dto);
    }
}
