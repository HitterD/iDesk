import { ArrayMaxSize, IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { NoteDocumentNode } from '../entities/ticket-note.entity';

export class CreateTicketNoteDto {
    @IsOptional() @IsString() @MaxLength(200) title?: string;
    @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) memberIds: string[] = [];
}

export class AddTicketNoteMembersDto {
    @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) userIds: string[];
}

export class TicketNoteSessionDto {
    @IsUUID() sessionId: string;
}

export class SaveTicketNoteDto extends TicketNoteSessionDto {
    @IsInt() @Min(0) expectedVersion: number;
    @IsObject() document: NoteDocumentNode;
}

export class PostTicketNoteMessageDto {
    @IsString() @MaxLength(10_000) content: string;
    @IsUUID() clientRequestId: string;
    @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) mentionedUserIds: string[] = [];
    @IsArray() @ArrayMaxSize(5) @IsUUID('all', { each: true }) attachmentIds: string[] = [];
}

export class TicketNoteSolutionDto {
    @IsOptional() @IsUUID() messageId: string | null;
}

export class TicketNoteReadDto {
    @IsInt() @Min(0) throughSequence: number;
}

export class ShareTicketNoteMessageDto {
    @IsUUID() messageId: string;
    @IsUUID() clientRequestId: string;
}
