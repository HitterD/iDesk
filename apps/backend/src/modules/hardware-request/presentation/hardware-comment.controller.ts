import {
    Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe,
    Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { HardwareRoleGuard, pickRole } from '../guards/hardware-role.guard';
import { HardwareCommentService } from '../services/hardware-comment.service';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { UpdateCommentDto } from '../dto/update-comment.dto';

@Controller('hardware-requests/:id/comments')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
export class HardwareCommentController {
    constructor(private readonly service: HardwareCommentService) {}

    @Get()
    async list(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) requestId: string,
    ) {
        const role = pickRole(req.user);
        const data = await this.service.list({ id: req.user.userId, role }, requestId);
        return { success: true, data };
    }

    @Post()
    async add(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) requestId: string,
        @Body() dto: CreateCommentDto,
    ) {
        const role = pickRole(req.user);
        const data = await this.service.add({ id: req.user.userId, role }, requestId, dto);
        return { success: true, data };
    }

    @Patch(':commentId')
    async edit(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) requestId: string,
        @Param('commentId', new ParseUUIDPipe()) commentId: string,
        @Body() dto: UpdateCommentDto,
    ) {
        const role = pickRole(req.user);
        const data = await this.service.edit(
            { id: req.user.userId, role }, requestId, commentId, dto,
        );
        return { success: true, data };
    }

    @Delete(':commentId')
    @HttpCode(204)
    async remove(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) requestId: string,
        @Param('commentId', new ParseUUIDPipe()) commentId: string,
    ) {
        const role = pickRole(req.user);
        await this.service.softDelete({ id: req.user.userId, role }, requestId, commentId);
    }
}
