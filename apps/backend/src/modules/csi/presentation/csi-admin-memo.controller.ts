import { Body, Controller, Get, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { MemoHeaderDto, MemoRequestDto } from '../dto/memo.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiMemoService } from '../services/csi-memo.service';

type CsiAdminRequest = Request & { csiScope: ServiceScope };

@Controller('csi/admin/:scope')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminMemoController {
    constructor(private readonly memos: CsiMemoService) { }

    @Get('memo-settings')
    getSettings(@Req() req: CsiAdminRequest) {
        return this.memos.getSettings(req.csiScope);
    }

    @Put('memo-settings')
    saveSettings(@Req() req: CsiAdminRequest, @Body() dto: MemoHeaderDto) {
        return this.memos.saveSettings(req.csiScope, dto);
    }

    @Post('reports/memo')
    async memo(@Req() req: CsiAdminRequest, @Body() dto: MemoRequestDto, @Res() res: Response) {
        const { filename, buffer } = await this.memos.buildMemo(req.csiScope, dto.periodIds, dto.header);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }
}
