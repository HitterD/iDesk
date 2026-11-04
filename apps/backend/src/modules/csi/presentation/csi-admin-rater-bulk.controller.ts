import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RaterGroupDto, RaterIdsDto, RaterImportDto } from '../dto/master.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiRaterBulkService } from '../services/csi-rater-bulk.service';

type CsiAdminRequest = { csiScope: ServiceScope };

/** Bulk rater registration: per group (site / HR department), per imported list, and bulk removal. */
@Controller('csi/admin/:scope/raters')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminRaterBulkController {
    constructor(private readonly bulk: CsiRaterBulkService) { }

    @Get('group-departments')
    departments(@Query() query: RaterGroupDto) {
        return this.bulk.departmentOptions(query.siteId);
    }

    @Get('group-preview')
    preview(@Req() req: CsiAdminRequest, @Query() query: RaterGroupDto) {
        return this.bulk.previewGroup(req.csiScope, query);
    }

    @Post('group')
    addGroup(@Req() req: CsiAdminRequest, @Body() dto: RaterGroupDto) {
        return this.bulk.addGroup(req.csiScope, dto);
    }

    @Post('import')
    @HttpCode(HttpStatus.OK)
    importKeys(@Req() req: CsiAdminRequest, @Body() dto: RaterImportDto) {
        return this.bulk.importKeys(req.csiScope, dto.keys, dto.commit);
    }

    @Post('remove')
    @HttpCode(HttpStatus.OK)
    removeMany(@Req() req: CsiAdminRequest, @Body() dto: RaterIdsDto) {
        return this.bulk.removeMany(req.csiScope, dto.ids);
    }
}
