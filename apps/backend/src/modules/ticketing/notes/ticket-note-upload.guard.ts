import { CanActivate, ExecutionContext, Injectable, ParseUUIDPipe } from '@nestjs/common';
import { TicketNoteAccessService } from './ticket-note-access.service';

/** Runs before multipart buffering; authentication alone is not note authorization. */
@Injectable()
export class TicketNoteUploadGuard implements CanActivate {
    constructor(private readonly access: TicketNoteAccessService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const actorId = req.user?.userId || req.user?.id;
        const pipe = new ParseUUIDPipe();
        await pipe.transform(req.params.id, { type: 'param' });
        await pipe.transform(req.params.noteId, { type: 'param' });
        const { ticket } = await this.access.assertMember(req.params.noteId, actorId, undefined, false, req.params.id);
        this.access.assertWritable(ticket);
        return true;
    }
}
