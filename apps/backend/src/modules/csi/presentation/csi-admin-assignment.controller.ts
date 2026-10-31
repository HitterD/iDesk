import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { SetAssignmentsDto } from '../dto/assignment.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiAssignmentService } from '../services/csi-assignment.service';

type CsiAdminRequest = { csiScope: ServiceScope; user: { userId: string } };
const CSI_ID_PIPE = new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException('ID harus berupa UUID'),
});

@Controller('csi/admin/:scope/periods/:id/assignments')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminAssignmentController {
    constructor(private readonly assignments: CsiAssignmentService) { }

    @Get()
    get(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.assignments.get(req.csiScope, id);
    }

    @Put()
    set(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: SetAssignmentsDto) {
        return this.assignments.setPairs(req.csiScope, id, dto.pairs);
    }

    @Post('auto-same-site')
    autoSameSite(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.assignments.autoSameSite(req.csiScope, id);
    }

    @Post('save-template')
    saveTemplate(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.assignments.saveTemplate(req.csiScope, id);
    }

    @Post('apply-template')
    applyTemplate(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.assignments.applyTemplate(req.csiScope, id);
    }
}
