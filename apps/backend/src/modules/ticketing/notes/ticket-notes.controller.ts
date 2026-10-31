import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { TicketNoteAccessService } from './ticket-note-access.service';
import { TicketNotePublicShareService } from './ticket-note-public-share.service';
import { TicketNoteUploadGuard } from './ticket-note-upload.guard';
import { TicketNoteCommandService } from './ticket-note-command.service';
import { TicketNoteQueryService } from './ticket-note-query.service';
import { TicketNoteDocumentService } from './ticket-note-document.service';
import { TicketNoteDiscussionService } from './ticket-note-discussion.service';
import { TicketNoteAttachmentService } from './ticket-note-attachment.service';
import { AddTicketNoteMembersDto, CreateTicketNoteDto, PostTicketNoteMessageDto, SaveTicketNoteDto,
    TicketNoteReadDto, TicketNoteSessionDto, TicketNoteSolutionDto, ShareTicketNoteMessageDto } from './dto/ticket-note.dto';

@Controller('tickets/:id/notes')
@UseGuards(JwtAuthGuard)
export class TicketNotesController {
    constructor(private readonly access: TicketNoteAccessService, private readonly commands: TicketNoteCommandService,
        private readonly queries: TicketNoteQueryService, private readonly documents: TicketNoteDocumentService,
        private readonly discussion: TicketNoteDiscussionService, private readonly attachments: TicketNoteAttachmentService,
        private readonly publicShare: TicketNotePublicShareService) {}

    @Get() list(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.queries.list(id, this.actor(req));
    }
    @Get('candidates') candidates(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Query('search') search?: string) {
        return this.queries.candidates(id, this.actor(req), search);
    }
    @Post() create(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Body() input: CreateTicketNoteDto) {
        return this.commands.create(id, this.actor(req), input);
    }
    @Get(':noteId') detail(@Param('id', ParseUUIDPipe) id: string, @Param('noteId', ParseUUIDPipe) noteId: string, @Req() req: any) {
        return this.queries.detail(noteId, this.actor(req), id);
    }
    @Delete(':noteId') async remove(@Param() params: Record<string, string>, @Req() req: any) {
        await this.check(params, req); return this.commands.softDelete(params.noteId, this.actor(req));
    }
    @Post(':noteId/members') async addMembers(@Param() params: Record<string, string>, @Req() req: any, @Body() input: AddTicketNoteMembersDto) {
        await this.check(params, req); return this.commands.addMembers(params.noteId, this.actor(req), input.userIds);
    }
    @Delete(':noteId/members/:userId') async removeMember(@Param() params: Record<string, string>, @Req() req: any) {
        await this.check(params, req); return this.commands.removeMember(params.noteId, this.actor(req), params.userId);
    }
    @Post(':noteId/lease') async acquire(@Param() params: Record<string, string>, @Req() req: any) {
        await this.check(params, req); return this.documents.acquire(params.noteId, this.actor(req));
    }
    @Post(':noteId/lease/heartbeat') async heartbeat(@Param() params: Record<string, string>, @Req() req: any, @Body() input: TicketNoteSessionDto) {
        await this.check(params, req); return this.documents.heartbeat(params.noteId, this.actor(req), input.sessionId);
    }
    @Post(':noteId/lease/release') async release(@Param() params: Record<string, string>, @Req() req: any, @Body() input: TicketNoteSessionDto) {
        await this.check(params, req); return this.documents.release(params.noteId, this.actor(req), input.sessionId);
    }
    @Put(':noteId/document') async save(@Param() params: Record<string, string>, @Req() req: any, @Body() input: SaveTicketNoteDto) {
        await this.check(params, req); return this.documents.save(params.noteId, this.actor(req), input);
    }
    @Get(':noteId/revisions') async revisions(@Param() params: Record<string, string>, @Req() req: any) {
        await this.check(params, req); return this.documents.revisions(params.noteId, this.actor(req));
    }
    @Get(':noteId/messages') async messages(@Param() params: Record<string, string>, @Req() req: any, @Query('before') before?: string) {
        await this.check(params, req); return this.discussion.messages(params.noteId, this.actor(req), before ? Number(before) : undefined);
    }
    @Post(':noteId/messages') async post(@Param() params: Record<string, string>, @Req() req: any, @Body() input: PostTicketNoteMessageDto) {
        await this.check(params, req); return this.discussion.post(params.noteId, this.actor(req), input);
    }
    @Put(':noteId/solution') async solution(@Param() params: Record<string, string>, @Req() req: any, @Body() input: TicketNoteSolutionDto) {
        await this.check(params, req); return this.discussion.solution(params.noteId, this.actor(req), input.messageId);
    }
    @Post(':noteId/public-reply') async share(@Param() params: Record<string, string>, @Req() req: any, @Body() input: ShareTicketNoteMessageDto) {
        await this.check(params, req); return this.publicShare.share(params.noteId, this.actor(req), input.messageId, input.clientRequestId);
    }
    @Post(':noteId/read') async read(@Param() params: Record<string, string>, @Req() req: any, @Body() input: TicketNoteReadDto) {
        await this.check(params, req); return this.discussion.markRead(params.noteId, this.actor(req), input.throughSequence);
    }
    @Post(':noteId/attachments')
    @UseGuards(TicketNoteUploadGuard)
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
    async upload(@Param() params: Record<string, string>, @Req() req: any, @UploadedFile() file: Express.Multer.File) {
        await this.check(params, req); return this.attachments.upload(params.noteId, this.actor(req), file);
    }
    @Get(':noteId/attachments/:attachmentId')
    async download(@Param() params: Record<string, string>, @Req() req: any, @Res() res: Response) {
        await this.check(params, req);
        const file = await this.attachments.download(params.noteId, this.actor(req), params.attachmentId);
        res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': file.mime });
        res.sendFile(file.filePath);
    }
    private actor(req: any): string { return req.user.userId || req.user.id; }
    private async check(params: Record<string, string>, req: any): Promise<void> {
        for (const id of Object.values(params)) await new ParseUUIDPipe().transform(id, { type: 'param' });
        await this.access.assertMember(params.noteId, this.actor(req), undefined, false, params.id);
    }
}
