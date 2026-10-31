import { BadRequestException } from '@nestjs/common';
import { NoteDocumentNode } from './entities/ticket-note.entity';

const MAX_DOCUMENT_BYTES = 500_000;
const MAX_DOCUMENT_DEPTH = 20;
const MAX_DOCUMENT_NODES = 10_000;
const NODE_ATTRIBUTES: Record<string, string[]> = {
    doc: [], paragraph: [], text: [], hardBreak: [], horizontalRule: [], blockquote: [],
    bulletList: [], orderedList: ['start', 'type'], listItem: [], heading: ['level'],
    codeBlock: ['language'], taskList: [], taskItem: ['checked'], image: ['attachmentId'],
};
const MARKS = new Set(['bold', 'italic', 'strike', 'code', 'underline']);

export function validateNoteDocument(value: unknown, attachmentIds: string[]): asserts value is NoteDocumentNode {
    if (JSON.stringify(value)?.length > MAX_DOCUMENT_BYTES) throw new BadRequestException('Dokumen terlalu besar.');
    const state = { count: 0, attachmentIds: new Set(attachmentIds) };
    validateNode(value, 0, state);
    if ((value as NoteDocumentNode).type !== 'doc') throw new BadRequestException('Dokumen tidak valid.');
}

function validateNode(value: unknown, depth: number, state: { count: number; attachmentIds: Set<string> }): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
    if (depth > MAX_DOCUMENT_DEPTH || ++state.count > MAX_DOCUMENT_NODES) invalid();
    const node = value as NoteDocumentNode;
    if (!Object.prototype.hasOwnProperty.call(NODE_ATTRIBUTES, node.type)) invalid();
    if (Object.keys(node).some(key => !['type', 'text', 'attrs', 'marks', 'content'].includes(key))) invalid();
    validateAttributes(node, state.attachmentIds);
    if (node.text !== undefined && (node.type !== 'text' || typeof node.text !== 'string')) invalid();
    if (node.marks !== undefined) {
        if (!Array.isArray(node.marks)) invalid();
        for (const mark of node.marks) {
            if (!mark || !MARKS.has(mark.type) || Object.keys(mark).some(key => key !== 'type')) invalid();
        }
    }
    if (node.content !== undefined) {
        if (!Array.isArray(node.content) || node.type === 'text' || node.type === 'image') invalid();
        for (const child of node.content) validateNode(child, depth + 1, state);
    }
}

function validateAttributes(node: NoteDocumentNode, attachmentIds: Set<string>): void {
    const attrs = node.attrs ?? {};
    if (typeof attrs !== 'object' || Array.isArray(attrs)) invalid();
    if (Object.keys(attrs).some(key => !NODE_ATTRIBUTES[node.type].includes(key))) invalid();
    if (node.type === 'image' && (typeof attrs.attachmentId !== 'string' || !attachmentIds.has(attrs.attachmentId))) invalid();
    if (attrs.level !== undefined && ![1, 2, 3].includes(attrs.level as number)) invalid();
    if (attrs.start !== undefined && (!Number.isSafeInteger(attrs.start) || (attrs.start as number) < 1)) invalid();
    if (attrs.type !== undefined && attrs.type !== null && !['1', 'a', 'A', 'i', 'I'].includes(attrs.type as string)) invalid();
    if (attrs.checked !== undefined && typeof attrs.checked !== 'boolean') invalid();
    if (attrs.language !== undefined && attrs.language !== null && (typeof attrs.language !== 'string' || !/^[\w+-]{0,30}$/.test(attrs.language))) invalid();
}

function invalid(): never {
    throw new BadRequestException('Struktur dokumen tidak valid.');
}
