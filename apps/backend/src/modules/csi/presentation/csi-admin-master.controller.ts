import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { AddRatersDto, CreateDepartmentDto, CreateDimensionDto, MasterListQueryDto, UpdateDepartmentDto, UpdateDimensionDto, UserSearchQueryDto } from '../dto/master.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiMasterService } from '../services/csi-master.service';

type CsiAdminRequest = { csiScope: ServiceScope };
const CSI_ID_PIPE = new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException('ID harus berupa UUID'),
});

@Controller('csi/admin/:scope')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminMasterController {
    constructor(private readonly master: CsiMasterService) { }

    @Get('dimensions')
    listDimensions(@Req() req: CsiAdminRequest, @Query() query: MasterListQueryDto) {
        return this.master.listDimensions(req.csiScope, query.includeInactive);
    }

    @Post('dimensions')
    createDimension(@Req() req: CsiAdminRequest, @Body() dto: CreateDimensionDto) {
        return this.master.createDimension(req.csiScope, dto);
    }

    @Patch('dimensions/:id')
    updateDimension(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: UpdateDimensionDto) {
        return this.master.updateDimension(req.csiScope, id, dto);
    }

    @Delete('dimensions/:id')
    deactivateDimension(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.master.deactivateDimension(req.csiScope, id);
    }

    @Get('departments')
    listDepartments(@Req() req: CsiAdminRequest, @Query() query: MasterListQueryDto) {
        return this.master.listDepartments(req.csiScope, query.includeInactive);
    }

    @Post('departments')
    createDepartment(@Req() req: CsiAdminRequest, @Body() dto: CreateDepartmentDto) {
        return this.master.createDepartment(req.csiScope, dto);
    }

    @Patch('departments/:id')
    updateDepartment(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: UpdateDepartmentDto) {
        return this.master.updateDepartment(req.csiScope, id, dto);
    }

    @Delete('departments/:id')
    deactivateDepartment(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.master.deactivateDepartment(req.csiScope, id);
    }

    @Get('raters')
    listRaters(@Req() req: CsiAdminRequest) {
        return this.master.listRaters(req.csiScope);
    }

    @Post('raters')
    addRaters(@Req() req: CsiAdminRequest, @Body() dto: AddRatersDto) {
        return this.master.addRaters(req.csiScope, dto.userIds);
    }

    @Delete('raters/:id')
    removeRater(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.master.removeRater(req.csiScope, id);
    }

    @Get('users')
    searchUsers(@Query() query: UserSearchQueryDto) {
        return this.master.searchUsers(query.search, query.limit);
    }
}
