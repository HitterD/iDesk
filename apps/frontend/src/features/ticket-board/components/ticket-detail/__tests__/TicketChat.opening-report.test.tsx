import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TicketChat } from '../TicketChat';
import type { TicketDetail } from '../types';

vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-1', role: 'ADMIN', fullName: 'System Administrator' } }) }));
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const REQUESTER = { id: 'user-1', fullName: 'CHRISTHIN MAGDALENA', role: 'USER' };
const ADMIN = { id: 'admin-1', fullName: 'System Administrator', role: 'ADMIN' };
const AGENT_FILE = '/uploads/tickets/t-1/agent-screenshot.png';
const REPORT_FILE = '/uploads/tickets/t-1/report-photo.png';

const ticket = (messages: object[]) => ({
    id: 't-1', ticketNumber: '191026-PRO-0001', title: '[QA] Uji toast chat iDesk', description: 'Tiket uji untuk toast chat iDesk.',
    status: 'IN_PROGRESS', priority: 'MEDIUM', createdAt: '2026-10-19T06:24:00Z', updatedAt: '2026-10-19T06:24:00Z',
    viewerAccess: 'handler', user: { id: 'user-1', fullName: 'CHRISTHIN MAGDALENA' }, messages,
}) as unknown as TicketDetail;

const msg = (id: string, sender: object, content: string, at: string, attachments: string[] = []) => ({
    id, content, createdAt: at, isSystemMessage: false, attachments, sender,
});
const renderChat = (t: TicketDetail) => render(
    <QueryClientProvider client={new QueryClient()}>
        <TicketChat ticket={t} isConnected onSendMessage={vi.fn(() => Promise.resolve())} onImageClick={vi.fn()} />
    </QueryClientProvider>,
);
const reportCard = () => document.querySelector('[data-root-issue]') as HTMLElement;

describe('TicketChat opening report', () => {
    beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });

    it("never shows a later reply's attachment as the requester's opening-report attachment", () => {
        renderChat(ticket([
            msg('report', REQUESTER, 'Tiket uji untuk toast chat iDesk.', '2026-10-19T06:24:00Z'),
            msg('reply', REQUESTER, 'Wifi masih putus', '2026-10-19T06:25:00Z'),
            msg('agent', ADMIN, 'ini ya', '2026-11-02T06:35:00Z', [AGENT_FILE]),
        ]));

        expect(reportCard().innerHTML).not.toContain('agent-screenshot');
        expect(document.querySelector('[data-pinned-bar]')?.textContent ?? '').not.toMatch(/1\s*$/);
        // The agent's file stays in the agent's own bubble.
        expect(document.querySelector('[data-message-id="agent"]')?.innerHTML).toContain('agent-screenshot');
    });

    it('shows the files that came with the opening report', () => {
        renderChat(ticket([
            msg('report', REQUESTER, 'Tiket uji untuk toast chat iDesk.', '2026-10-19T06:24:00Z', [REPORT_FILE]),
            msg('agent', ADMIN, 'ini ya', '2026-11-02T06:35:00Z', [AGENT_FILE]),
        ]));

        expect(reportCard().innerHTML).toContain('report-photo');
        expect(reportCard().innerHTML).not.toContain('agent-screenshot');
    });
});
