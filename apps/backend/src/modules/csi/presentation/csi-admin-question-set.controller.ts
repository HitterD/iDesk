import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { QuestionSetDto } from '../dto/question-set.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiQuestionSetService } from '../services/csi-question-set.service';

type CsiAdminRequest = { csiScope: ServiceScope };
const CSI_ID_PIPE = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID harus berupa UUID') });

@Controller('csi/admin/:scope/question-sets')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminQuestionSetController {
    constructor(private readonly sets: CsiQuestionSetService) { }

    @Get()
    list(@Req() req: CsiAdminRequest) {
        return this.sets.list(req.csiScope);
    }

    @Post()
    create(@Req() req: CsiAdminRequest, @Body() dto: QuestionSetDto) {
        return this.sets.create(req.csiScope, dto);
    }

    @Put(':id')
    update(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: QuestionSetDto) {
        return this.sets.update(req.csiScope, id, dto);
    }

    @Delete(':id')
    remove(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.sets.remove(req.csiScope, id);
    }
}
