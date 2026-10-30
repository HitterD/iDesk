import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createUploadsFileHandler } from './uploads-file.handler';

const TICKET_ID = '11111111-2222-3333-4444-555555555555';

function makeRes() {
    const res: any = { headers: {} as Record<string, string> };
    res.status = jest.fn((code: number) => { res.statusCode = code; return res; });
    res.send = jest.fn(() => res);
    res.sendFile = jest.fn((p: string) => { res.sentFile = p; });
    res.setHeader = jest.fn((k: string, v: string) => { res.headers[k] = v; });
    res.attachment = jest.fn((name: string) => { res.attachmentName = name; });
    return res;
}

const req = (p: string, method = 'GET'): any => ({ method, path: p, headers: {}, cookies: {} });

describe('createUploadsFileHandler', () => {
    let root: string;
    const viewer = { id: 'u1', role: 'USER', siteId: null } as any;
    let access: { authenticate: jest.Mock; authorize: jest.Mock };

    beforeAll(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
        fs.mkdirSync(path.join(root, 'tickets', TICKET_ID), { recursive: true });
        fs.writeFileSync(path.join(root, 'tickets', TICKET_ID, 'abc-1.zip'), 'zip');
        fs.writeFileSync(path.join(root, 'tickets', TICKET_ID, 'abc-2.png'), 'png');
        fs.writeFileSync(path.join(root, 'tickets', TICKET_ID, 'abc-3.mp4'), 'mp4');
        fs.writeFileSync(path.join(root, 'avatar.png'), 'public');
        fs.mkdirSync(path.join(root, 'eform-approvals'), { recursive: true });
        fs.writeFileSync(path.join(root, 'eform-approvals', 'signed.pdf'), '%PDF');
    });

    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    beforeEach(() => {
        access = {
            authenticate: jest.fn(() => viewer),
            authorize: jest.fn(async () => ({ ok: true, downloadName: 'Laporan Q3.zip' })),
        };
    });

    const run = async (r: any) => {
        const res = makeRes();
        const next = jest.fn();
        await createUploadsFileHandler(root, access)(r, res, next);
        return { res, next };
    };

    it('serves non-ticket files without auth', async () => {
        const { res } = await run(req('/avatar.png'));
        expect(res.sentFile).toBe(path.join(root, 'avatar.png'));
        expect(access.authenticate).not.toHaveBeenCalled();
    });

    it('never serves GM-signed e-forms by URL, even to a signed-in user, nor lets the static fallback try', async () => {
        for (const p of ['/eform-approvals/signed.pdf', '/EFORM-APPROVALS/signed.pdf', '/eform-approvals/']) {
            const { res, next } = await run(req(p));
            expect(res.statusCode).toBe(404);
            expect(res.sendFile).not.toHaveBeenCalled();
            expect(next).not.toHaveBeenCalled();
        }
    });

    it('answers 401 for a ticket file without a valid session', async () => {
        access.authenticate.mockReturnValue(null);
        const { res } = await run(req(`/tickets/${TICKET_ID}/abc-1.zip`));
        expect(res.statusCode).toBe(401);
        expect(res.sendFile).not.toHaveBeenCalled();
    });

    it('answers with the denial status when the user cannot open the ticket', async () => {
        access.authorize.mockResolvedValue({ ok: false, status: 403 });
        const { res } = await run(req(`/tickets/${TICKET_ID}/abc-1.zip`));
        expect(res.statusCode).toBe(403);
        expect(res.sendFile).not.toHaveBeenCalled();
    });

    it('forces a download under the original name for non-image files', async () => {
        const { res } = await run(req(`/tickets/${TICKET_ID}/abc-1.zip`));
        expect(access.authorize).toHaveBeenCalledWith(viewer, `tickets/${TICKET_ID}/abc-1.zip`);
        expect(res.attachmentName).toBe('Laporan Q3.zip');
        expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
        expect(res.sentFile).toBe(path.join(root, 'tickets', TICKET_ID, 'abc-1.zip'));
    });

    it('keeps images inline', async () => {
        const { res } = await run(req(`/tickets/${TICKET_ID}/abc-2.png`));
        expect(res.attachment).not.toHaveBeenCalled();
        expect(res.sentFile).toBe(path.join(root, 'tickets', TICKET_ID, 'abc-2.png'));
    });

    it('keeps videos inline so the chat can play them', async () => {
        const { res } = await run(req(`/tickets/${TICKET_ID}/abc-3.mp4`));
        expect(res.attachment).not.toHaveBeenCalled();
        expect(res.sentFile).toBe(path.join(root, 'tickets', TICKET_ID, 'abc-3.mp4'));
    });

    it('checks access for legacy flat URLs that resolve into a ticket folder', async () => {
        access.authenticate.mockReturnValue(null);
        const { res } = await run(req('/abc-1.zip'));
        expect(res.statusCode).toBe(401);
        expect(res.sendFile).not.toHaveBeenCalled();
    });

    it('never hands missing ticket paths to the static fallbacks', async () => {
        const { res, next } = await run(req(`/Tickets/${TICKET_ID}/missing.zip`));
        expect(res.statusCode).toBe(404);
        expect(next).not.toHaveBeenCalled();
    });

    it('decodes the path before deciding it is not a ticket file', async () => {
        access.authenticate.mockReturnValue(null);
        const { res } = await run(req(`/%74ickets/${TICKET_ID}/abc-1.zip`));
        expect(res.statusCode).toBe(401);
    });

    it('rejects traversal outside the upload root', async () => {
        const { res } = await run(req('/../secret.txt'));
        expect(res.statusCode).toBe(403);
    });

    it('passes other methods and unknown non-ticket files through', async () => {
        expect((await run(req('/avatar.png', 'POST'))).next).toHaveBeenCalled();
        expect((await run(req('/nope.png'))).next).toHaveBeenCalled();
    });
});
