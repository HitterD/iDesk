import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { RequestFormScreen } from '../RequestFormScreen';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const auth = { user: { id: 'u-1', role: 'USER', fullName: 'Leony' } };
vi.mock('@/stores/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/components/ui/SignaturePad', () => ({
    SignaturePad: ({ onSave }: { onSave: (dataUrl: string) => void }) => <button type="button" onClick={() => onSave('data:image/png;base64,AAAA')}>Simpan tanda tangan</button>,
}));
vi.mock('@/features/request-center/components/eform/ManagerSelector', () => ({ ManagerSelector: () => <div>pilih atasan</div> }));
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }));

afterEach(cleanup);
beforeEach(() => {
    localStorage.clear(); navigate.mockReset();
    vi.mocked(api.get).mockImplementation(async (url: string) => ({
        data: url === '/hardware-requests/catalog' ? { data: [{ id: 'c-1', code: 'LAP', name: 'Laptop Standar', category: 'LAPTOP', requiredFields: [] }] } : { department: { name: 'QC' } },
    }));
    vi.mocked(api.post).mockResolvedValue({ data: { ticketId: 't-9', ticketNumber: '221126-QC-0001' } });
});

function renderScreen() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><RequestFormScreen type="hardware" onBack={vi.fn()} renewFrom={null} /></QueryClientProvider>);
}

async function submit() {
    const listbox = await screen.findByRole('listbox', { name: 'Katalog' });
    fireEvent.click(listbox.querySelector('button')!);
    fireEvent.change(screen.getByLabelText('Alasan permintaan'), { target: { value: 'Staf baru' } });
    fireEvent.click(screen.getByText('Simpan tanda tangan'));
    fireEvent.click(screen.getByRole('button', { name: 'Kirim permintaan' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
}

describe('RequestFormScreen', () => {
    it('the requester portal opens the new ticket under /client', async () => {
        auth.user.role = 'USER';
        renderScreen();
        await submit();
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/client/tickets/t-9'));
    });

    it('staff open the new ticket in the staff portal', async () => {
        auth.user.role = 'AGENT_OPERATIONAL_SUPPORT';
        renderScreen();
        await submit();
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/tickets/t-9'));
    });

    it('a new hardware request starts with the requester as the recipient', async () => {
        auth.user.role = 'USER';
        renderScreen();
        await submit();
        expect(api.post).toHaveBeenCalledWith('/request-flow/hardware', expect.objectContaining({ recipients: ['Leony'] }));
    });
});
