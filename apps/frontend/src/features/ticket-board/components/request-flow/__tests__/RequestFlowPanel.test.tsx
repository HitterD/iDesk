import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import type { FlowPhase, RequestFlowView, ViewerRoleInFlow } from '../flowTypes';
import { RequestFlowPanel } from '../RequestFlowPanel';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'it-1', role: 'AGENT_OPERATIONAL_SUPPORT', fullName: 'RM Bagastyo' } }) }));
vi.mock('@/components/ui/SignaturePad', () => ({
    SignaturePad: ({ onSave }: { onSave: (dataUrl: string) => void }) => <button type="button" onClick={() => onSave('data:image/png;base64,AAAA')}>Simpan tanda tangan</button>,
}));
vi.mock('@/features/request-center/components/eform/ManagerSelector', () => ({ ManagerSelector: () => <div>pilih orang</div> }));

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));

afterEach(cleanup);

const TID = '0b6d3c4e-1111-4222-8333-444455556677';

function view(phase: FlowPhase, role: ViewerRoleInFlow, over: Partial<RequestFlowView> = {}): RequestFlowView {
    return {
        kind: 'EFORM', phase, phaseLabel: '', route: 'MANAGER', managerId: 'm', gmId: null, hardwareSource: null, returnedReason: null,
        rescheduleCount: 0, documentVersion: 2, viewerRoleInFlow: role,
        revisions: [{ version: 2, kind: 'DIG', label: 'TTD', actorName: 'Leony', createdAt: '2026-11-22T01:00:00.000Z' }],
        eform: { formType: 'VPN', documentNumber: 'F/1', startDate: '2026-11-01', endDate: '2026-12-31', fields: {}, hasCredentials: true, requiresGm: false },
        ...over,
    };
}

function renderPanel(flow: RequestFlowView) {
    vi.mocked(api.get).mockImplementation(async (url: string) => ({ data: url.startsWith('/request-flow/') ? flow : [] }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><RequestFlowPanel ticketId={TID} ticketNumber="221126-QC-0035" /></QueryClientProvider>);
}

describe('RequestFlowPanel', () => {
    beforeEach(() => { vi.mocked(api.get).mockReset(); vi.mocked(api.post).mockReset(); vi.mocked(api.post).mockResolvedValue({ data: {} }); });

    it('shows the next-step bar and the progress of the request', async () => {
        renderPanel(view('review', 'ICT'));
        expect(await screen.findByRole('button', { name: 'Tinjau sekarang' })).toBeInTheDocument();
        expect(screen.getByText(/Tahap 2\/4/)).toBeInTheDocument();
    });

    it('the primary button opens its dialog and sends the call to the right endpoint', async () => {
        renderPanel(view('review', 'ICT'));
        fireEvent.click(await screen.findByRole('button', { name: 'Tinjau sekarang' }));
        fireEvent.click(await screen.findByRole('radio', { name: /Tanpa persetujuan/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Langsung proses' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/request-flow/${TID}/review`, { route: 'NONE' }));
    });

    it('"Perpanjang akses" opens the e-form create page prefilled from this ticket', async () => {
        renderPanel(view('done', 'REQUESTER'));
        fireEvent.click(await screen.findByRole('button', { name: 'Perpanjang akses' }));
        expect(navigate).toHaveBeenCalledWith(`/client/create?type=eform&renewFrom=${TID}`);
        expect(api.post).not.toHaveBeenCalled();
    });

    it('a requester confirming sends OK straight away, with no dialog', async () => {
        renderPanel(view('confirm', 'REQUESTER'));
        fireEvent.click(await screen.findByRole('button', { name: 'Ya, berhasil' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/request-flow/${TID}/confirm`, { result: 'OK' }));
    });

    it('"Ada kendala" asks what is wrong first', async () => {
        renderPanel(view('confirm', 'REQUESTER'));
        fireEvent.click(await screen.findByRole('button', { name: 'Ada kendala' }));
        fireEvent.change(await screen.findByLabelText('Apa kendalanya?'), { target: { value: 'Tidak bisa login' } });
        fireEvent.click(screen.getByRole('button', { name: 'Kirim ke IT' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/request-flow/${TID}/confirm`, { result: 'ISSUE', note: 'Tidak bisa login' }));
    });

    it('IT reminding an approver sends it directly', async () => {
        renderPanel(view('appr_mgr', 'ICT'));
        fireEvent.click(await screen.findByRole('button', { name: 'Ingatkan' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/request-flow/${TID}/remind`, {}));
    });

    it('the install report asks an asset code only for the units that arrived', async () => {
        const item = (id: string, name: string, deliveryStatus: string) => ({ id, name, quantity: 1, note: null, recipient: 'Leony', deliveryStatus, procurementDecision: null, vendor: null, actualCost: null, invoiceNumber: null, invoiceDate: null });
        const schedule = { id: 's-1', slots: [{ start: '2026-11-25T02:00:00Z', end: '2026-11-25T03:00:00Z' }], chosen: 0, technicianName: 'Yudi', status: 'IN_PROGRESS', resched: 0, note: null };
        renderPanel(view('install', 'ICT', { kind: 'HARDWARE', eform: undefined, hardware: {
            requestId: 'hr-1', requestNumber: 'HR-1', division: 'QC', recipients: ['Leony'], schedule, assets: [],
            items: [item('i-1', 'Laptop', 'ARRIVED'), item('i-2', 'Mouse', 'PENDING')],
        } }));
        fireEvent.click(await screen.findByRole('button', { name: 'Selesaikan pemasangan' }));
        expect(await screen.findByLabelText('Kode aset Laptop')).toBeInTheDocument();
        expect(screen.queryByLabelText('Kode aset Mouse')).not.toBeInTheDocument();
    });

    it('a redo after an issue asks a code only for units that have no asset yet', async () => {
        const item = (id: string, name: string) => ({ id, name, quantity: 1, note: null, recipient: 'Leony', catalogId: null, fields: {}, deliveryStatus: 'ARRIVED', procurementDecision: 'APPROVED', vendor: null, actualCost: null, invoiceNumber: null, invoiceDate: null });
        const schedule = { id: 's-2', slots: [{ start: '2026-11-25T02:00:00Z', end: '2026-11-25T03:00:00Z' }], chosen: 0, technicianName: 'Yudi', status: 'IN_PROGRESS', resched: 0, note: null, technicianId: 'it-1' };
        renderPanel(view('install', 'ICT', { kind: 'HARDWARE', eform: undefined, hardware: {
            requestId: 'hr-1', requestNumber: 'HR-1', division: 'QC', recipients: ['Leony'], schedule,
            items: [item('i-1', 'Laptop'), item('i-2', 'Mouse')], assets: [{ code: 'AST-0001', itemId: 'i-1' }],
        } }));
        fireEvent.click(await screen.findByRole('button', { name: 'Selesaikan pemasangan' }));
        expect(await screen.findByLabelText('Kode aset Mouse')).toBeInTheDocument();
        expect(screen.queryByLabelText('Kode aset Laptop')).not.toBeInTheDocument();
    });

    it('the purchase dialog lists only the units nobody decided yet (a migrated request may have some decided already)', async () => {
        const item = (id: string, name: string, procurementDecision: string | null) => ({ id, name, quantity: 1, note: null, recipient: '', catalogId: null, fields: {}, deliveryStatus: 'PENDING', procurementDecision, vendor: null, actualCost: null, invoiceNumber: null, invoiceDate: null });
        renderPanel(view('procure', 'ICT', { kind: 'HARDWARE', eform: undefined, hardware: {
            requestId: 'hr-1', requestNumber: 'HR-1', division: 'QC', recipients: [], schedule: null, assets: [],
            items: [item('i-1', 'Laptop', 'APPROVED'), item('i-2', 'Mouse', null)],
        } }));
        fireEvent.click(await screen.findByRole('button', { name: 'Catat pembelian' }));
        const groups = await screen.findAllByRole('group');
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveAccessibleName(/Mouse/);
    });

    it('shows the items card for hardware and the access card for an e-form', async () => {
        renderPanel(view('review', 'ICT'));
        expect(await screen.findByRole('region', { name: 'Akses' })).toBeInTheDocument();
        cleanup();
        renderPanel(view('review', 'ICT', { kind: 'HARDWARE', eform: undefined, hardware: { requestId: 'hr-1', requestNumber: 'HR-1', division: 'QC', recipients: [], items: [], schedule: null, assets: [] } }));
        expect(await screen.findByRole('region', { name: 'Barang' })).toBeInTheDocument();
    });

describe('RequestFlowPanel slots (mockup: next-step bar above the chat, cards in the right inspector)', () => {
    const renderSlot = (flow: RequestFlowView, slot: 'bar' | 'rail') => {
        vi.mocked(api.get).mockImplementation(async (url: string) => ({ data: url.startsWith('/request-flow/') ? flow : [] }));
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        return render(<QueryClientProvider client={client}><RequestFlowPanel ticketId={TID} ticketNumber="221126-QC-0035" slot={slot} /></QueryClientProvider>);
    };
    beforeEach(() => { vi.mocked(api.get).mockReset(); });

    it('the bar slot shows only the next-step bar: no progress or document cards that would push the chat away', async () => {
        renderSlot(view('review', 'ICT'), 'bar');
        expect(await screen.findByRole('button', { name: 'Tinjau sekarang' })).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Progres' })).not.toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Akses' })).not.toBeInTheDocument();
    });

    it('the rail slot shows the cards (progress, items or access, document) and no next-step bar', async () => {
        renderSlot(view('review', 'ICT'), 'rail');
        expect(await screen.findByRole('region', { name: 'Progres' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Akses' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Tinjau sekarang' })).not.toBeInTheDocument();
    });
});
});
