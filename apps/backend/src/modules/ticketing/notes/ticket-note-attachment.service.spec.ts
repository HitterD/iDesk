import { BadRequestException } from '@nestjs/common';
import { TicketNoteAttachmentService } from './ticket-note-attachment.service';

describe('TicketNoteAttachmentService image validation', () => {
    const service = new TicketNoteAttachmentService({} as any, {} as any);
    it('rejects SVG even if labelled as an image', () => {
        expect(() => service.validate({ originalname: 'x.svg', buffer: Buffer.from('<svg/>'), size: 6 } as any))
            .toThrow(BadRequestException);
    });
    it('rejects a script renamed as png', () => {
        expect(() => service.validate({ originalname: 'x.png', buffer: Buffer.from('<script>'), size: 8 } as any)).toThrow();
    });
    it('accepts a png signature and determines MIME independently of the client', () => {
        expect(service.validate({ originalname: 'x.png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), size: 8 } as any))
            .toBe('image/png');
    });
    it('rejects images above 25 MiB', () => {
        expect(() => service.validate({ originalname: 'x.png', buffer: Buffer.from([137, 80, 78, 71]), size: 26 * 1024 * 1024 } as any)).toThrow();
    });
});
