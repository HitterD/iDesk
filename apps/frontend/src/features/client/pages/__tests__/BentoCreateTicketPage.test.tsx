import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import api from '@/lib/api';
import { BentoCreateTicketPage } from '../BentoCreateTicketPage';

const mockPageAccess = {
    hardware_requests: false,
    tickets: true,
    eform_access: true,
};

const ATTRIBUTES = {
    categories: [{ id: 'cat-1', type: 'CATEGORY', value: 'Printer Kantor' }],
    devices: [{ id: 'dev-1', type: 'DEVICE', value: 'Laptop Dell' }],
    software: [{ id: 'sw-1', type: 'SOFTWARE', value: 'SAP GUI' }],
    priorities: [],
};
const APPROVERS = [{ id: 'user-77', fullName: 'Budi Santoso', jobTitle: 'Staff', department: { name: 'Finance' } }];

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

vi.mock('@/hooks/usePermissions', () => ({
    useMyPermissions: () => ({ data: { pageAccess: mockPageAccess } }),
}));

const authState = vi.hoisted(() => ({ user: { id: 'u-1', role: 'USER', fullName: 'Test User' } as { id: string; role: string; fullName: string } }));
vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: authState.user }),
}));

const mockedGet = vi.mocked(api.get);
const mockedPost = vi.mocked(api.post);

function LocationProbe() {
    const location = useLocation();
    return <p data-testid="location">{location.pathname}</p>;
}

function renderPage(path = '/client/create') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/client/create" element={<BentoCreateTicketPage />} />
                    <Route path="/tickets/create" element={<BentoCreateTicketPage />} />
                    <Route path="*" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

const lastPostedFormData = () => {
    const call = mockedPost.mock.calls.at(-1);
    expect(call?.[0]).toBe('/tickets');
    return call?.[1] as FormData;
};

const seedDraft = (type: string, draft: Record<string, string>) =>
    localStorage.setItem(`ticket-draft-${type}`, JSON.stringify({ priority: 'MEDIUM', category: '', device: '', software: '', savedAt: new Date().toISOString(), ...draft }));

beforeEach(() => {
    localStorage.clear();
    authState.user = { id: 'u-1', role: 'USER', fullName: 'Test User' };
    mockedGet.mockImplementation((url: string) => {
        if (url === '/ticket-attributes') return Promise.resolve({ data: ATTRIBUTES });
        if (url.startsWith('/users/approvers')) return Promise.resolve({ data: APPROVERS });
        return Promise.resolve({ data: {} });
    });
    mockedPost.mockReset();
    mockedPost.mockResolvedValue({ data: { id: 'T-9' } });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('BentoCreateTicketPage catalogue', () => {
    it('hides Hardware & Budget card when user lacks pageAccess and never shows Lost Item Report', () => {
        renderPage();
        expect(screen.getByRole('heading', { name: 'Service Ticket' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Access Request' })).toBeInTheDocument();
        expect(screen.queryByText('Lost Item Report')).not.toBeInTheDocument();
        expect(screen.queryByText('Hardware & Budget')).not.toBeInTheDocument();
        expect(screen.queryByAltText('Maskot Pengadaan Hardware')).not.toBeInTheDocument();
    });

    it('falls back to the catalogue for an unknown type query parameter', () => {
        renderPage('/client/create?type=unexpected');
        expect(screen.getByRole('heading', { name: 'Buat Tiket Baru' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Service Ticket' })).toBeInTheDocument();
    });

    it('shows every permitted card with its original mascot in the two grouped sections', () => {
        renderPage();
        expect(screen.getByRole('heading', { name: /bantuan & kendala teknis/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /pengajuan layanan & akses/i })).toBeInTheDocument();
        const mascots: Array<[string, string]> = [
            ['Maskot IT Support Agent', '/characters/mascot-service.png'],
            ['Maskot Oracle & K2', '/characters/mascot-oracle.png'],
            ['Maskot Web Developer', '/characters/mascot-webdev.png'],
            ['Maskot Mobile Developer', '/characters/mascot-mobiledev.png'],
            ['Maskot Izin Akses', '/characters/mascot-access.png'],
        ];
        for (const [alt, src] of mascots) {
            expect(screen.getByAltText(alt)).toHaveAttribute('src', src);
        }
    });

    it('drops "#01" numbering and category tags from the cards', () => {
        renderPage();
        expect(screen.queryByText(/#0\d/)).not.toBeInTheDocument();
        expect(screen.queryByText('General Support')).not.toBeInTheDocument();
        expect(screen.queryByText('Enterprise System')).not.toBeInTheDocument();
    });

    it('filters the existing cards client-side from the catalogue search', () => {
        renderPage();
        const search = screen.getByRole('searchbox', { name: /cari jenis bantuan/i });
        fireEvent.change(search, { target: { value: 'oracle' } });
        expect(screen.getByRole('heading', { name: 'Oracle / K2 Request' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Service Ticket' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Access Request' })).not.toBeInTheDocument();

        fireEvent.change(search, { target: { value: 'zzz-tidak-ada' } });
        expect(screen.getByText(/tidak ada jenis bantuan yang cocok/i)).toBeInTheDocument();
    });

    it('opens the selected form type and navigates request cards to their existing routes', () => {
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: 'Pilih Oracle / K2 Request' }));
        expect(screen.getByRole('heading', { level: 1, name: 'Oracle / K2 Request' })).toBeInTheDocument();
        expect(document.getElementById('oracle-ticket-title')).toBeInTheDocument();
    });

    it('navigates the Access Request card to the existing e-form route', () => {
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: 'Pilih Access Request' }));
        expect(screen.getByTestId('location')).toHaveTextContent('/client/eform-access/new');
    });
});

describe('BentoCreateTicketPage forms', () => {
    it.each([
        ['service', 'Service Ticket', 'service-ticket-title'],
        ['oracle-request', 'Oracle / K2 Request', 'oracle-ticket-title'],
        ['web-dev-request', 'Web Developer Request', 'web-dev-ticket-title'],
        ['mobile-dev-request', 'Mobile Developer Request', 'mobile-dev-ticket-title'],
    ])('keeps the %s route type value', (type, title, titleId) => {
        renderPage(`/client/create?type=${type}`);
        expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
        expect(document.getElementById(titleId)).toBeInTheDocument();
    });

    it('keeps classification dropdowns only on the service form', async () => {
        renderPage('/client/create?type=oracle-request');
        expect(screen.queryByRole('button', { name: 'Kategori' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Perangkat' })).not.toBeInTheDocument();
    });

    it('fills the existing fields from a quick template', () => {
        renderPage('/client/create?type=service');
        fireEvent.click(screen.getByRole('button', { name: 'Email Issue' }));
        expect(screen.getByRole('button', { name: 'Email Issue' })).toHaveAttribute('aria-pressed', 'true');
        expect(document.getElementById('service-ticket-title')).toHaveValue('Email tidak bisa diakses');
        expect(document.getElementById('service-ticket-description')).toHaveValue('Tidak dapat mengirim atau menerima email. Error message: ');
        expect(screen.getByRole('radio', { name: 'Urgent (Major Impact)' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('button', { name: 'Kategori' })).toHaveTextContent('Software');
    });

    it('updates the title and description counters', () => {
        renderPage('/client/create?type=service');
        fireEvent.change(document.getElementById('service-ticket-title')!, { target: { value: 'Printer macet' } });
        expect(screen.getByText('13 / 200')).toBeInTheDocument();
        fireEvent.change(document.getElementById('service-ticket-description')!, { target: { value: 'pendek' } });
        expect(screen.getByText(/kurang 4 karakter/i)).toBeInTheDocument();
    });

    it('keeps counters out of the field accessible names', () => {
        renderPage('/client/create?type=service');
        fireEvent.change(document.getElementById('service-ticket-title')!, { target: { value: 'Printer macet' } });
        fireEvent.change(document.getElementById('service-ticket-description')!, { target: { value: 'pendek' } });
        expect(screen.getByLabelText('Judul', { exact: true })).toHaveAttribute('id', 'service-ticket-title');
        expect(screen.getByLabelText('Detail masalah', { exact: true })).toHaveAttribute('id', 'service-ticket-description');
    });

    it.each([
        ['service', 'Justifikasi Blocker (Critical)', 'Jelaskan alasan urgensi prioritas blocker (critical)...'],
        ['oracle-request', 'Justifikasi Tiket Blocker (Critical)', 'Jelaskan mengapa masalah ini menjadi pemblokir (blocker) / berdampak kritis bagi operasional...'],
    ])('keeps the original %s critical justification wording', (type, label, placeholder) => {
        renderPage(`/client/create?type=${type}`);
        fireEvent.click(screen.getByRole('radio', { name: 'Blocker (Critical)' }));
        expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('placeholder', placeholder);
    });

    it('shows no error banner while a valid title is typed', () => {
        renderPage('/client/create?type=service');
        const title = document.getElementById('service-ticket-title') as HTMLInputElement;
        fireEvent.change(title, { target: { value: 'jar' } });
        expect(screen.getAllByText('Judul tiket minimal 5 karakter').length).toBeGreaterThan(0);
        fireEvent.change(title, { target: { value: 'jaringan error' } });
        expect(screen.queryByText('Mohon perbaiki isian yang ditandai.')).not.toBeInTheDocument();
        expect(screen.queryByText('Judul tiket minimal 5 karakter')).not.toBeInTheDocument();
    });

    it('presents urgency as a segmented control with the existing priority values', () => {
        renderPage('/client/create?type=web-dev-request');
        const group = screen.getByRole('radiogroup', { name: /seberapa mendesak/i });
        const radios = within(group).getAllByRole('radio');
        expect(radios.map(radio => radio.textContent)).toEqual(['Low', 'Normal', 'Urgent', 'Blocker']);
        expect(within(group).getByRole('radio', { name: 'Normal (Moderate)' })).toHaveAttribute('aria-checked', 'true');
    });

    it('uses the amber CTA for the submit action', () => {
        renderPage('/client/create?type=service');
        expect(screen.getByRole('button', { name: /kirim service ticket/i })).toHaveClass('idesk-cta');
    });

    it('does not POST an invalid form', () => {
        renderPage('/client/create?type=service');
        fireEvent.change(document.getElementById('service-ticket-title')!, { target: { value: 'abc' } });
        fireEvent.change(document.getElementById('service-ticket-description')!, { target: { value: 'pendek' } });
        fireEvent.click(screen.getByRole('button', { name: /kirim service ticket/i }));
        expect(mockedPost).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('Judul tiket minimal 5 karakter');
    });

    it('submits the current FormData with real attribute values and files, then clears the draft and redirects', async () => {
        const user = userEvent.setup();
        renderPage('/client/create?type=service');
        await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/ticket-attributes'));

        fireEvent.change(document.getElementById('service-ticket-title')!, { target: { value: 'Printer lantai 2 macet' } });
        fireEvent.change(document.getElementById('service-ticket-description')!, { target: { value: 'Kertas tersangkut terus sejak pagi.' } });

        await user.click(screen.getByRole('button', { name: 'Kategori' }));
        await user.click(await screen.findByRole('option', { name: 'Printer Kantor' }));
        await user.click(screen.getByRole('button', { name: 'Perangkat' }));
        await user.click(await screen.findByRole('option', { name: 'Laptop Dell' }));
        await user.click(screen.getByRole('button', { name: 'Aplikasi' }));
        await user.click(await screen.findByRole('option', { name: 'SAP GUI' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Urgent (Major Impact)' }));

        const file = new File(['%PDF'], 'bukti.pdf', { type: 'application/pdf' });
        await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);
        expect(screen.getByText('bukti.pdf')).toBeInTheDocument();

        seedDraft('service', { title: 'Printer lantai 2 macet', description: 'x' });
        await user.click(screen.getByRole('button', { name: /kirim service ticket/i }));

        await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
        const body = lastPostedFormData();
        expect(body.get('title')).toBe('Printer lantai 2 macet');
        expect(body.get('description')).toBe('Kertas tersangkut terus sejak pagi.');
        expect(body.get('priority')).toBe('HIGH');
        expect(body.get('category')).toBe('Printer Kantor');
        expect(body.get('device')).toBe('Laptop Dell');
        expect(body.get('software')).toBe('SAP GUI');
        expect(body.get('requesterId')).toBeNull();
        expect((body.getAll('files') as File[]).map(f => f.name)).toEqual(['bukti.pdf']);
        expect(mockedPost.mock.calls[0][2]).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/client/tickets/T-9'));
        expect(localStorage.getItem('ticket-draft-service')).toBeNull();
    });

    it.each([
        ['oracle-request', 'ORACLE_REQUEST', /kirim tiket oracle/i],
        ['web-dev-request', 'WEB_DEV_REQUEST', /kirim tiket web dev/i],
        ['mobile-dev-request', 'MOBILE_DEV_REQUEST', /kirim tiket mobile dev/i],
    ])('maps %s to its existing ticket type in the payload', async (type, mapped, submitName) => {
        renderPage(`/client/create?type=${type}`);
        const prefix = type.replace('-request', '');
        fireEvent.change(document.getElementById(`${prefix}-ticket-title`)!, { target: { value: 'Judul yang valid' } });
        fireEvent.change(document.getElementById(`${prefix}-ticket-description`)!, { target: { value: 'Deskripsi yang cukup panjang.' } });
        fireEvent.click(screen.getByRole('button', { name: submitName }));
        await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
        const body = lastPostedFormData();
        expect(body.get('category')).toBe(mapped);
        expect(body.get('ticketType')).toBe(mapped);
        expect(body.get('priority')).toBe('MEDIUM');
        expect(body.get('device')).toBeNull();
    });

    it('lets staff pick a requester with the real RequesterSelector and sends its ID', async () => {
        authState.user = { id: 'agent-1', role: 'AGENT', fullName: 'Agent' };
        const user = userEvent.setup();
        renderPage('/tickets/create?type=web-dev-request');

        await user.click(screen.getByRole('radio', { name: 'User lain' }));
        await user.click(screen.getByRole('combobox', { name: 'Pilih user requester' }));
        await user.click(await screen.findByRole('button', { name: /Budi Santoso/ }));
        expect(mockedGet).toHaveBeenCalledWith('/users/approvers?exclude=agent-1');

        fireEvent.change(document.getElementById('web-dev-ticket-title')!, { target: { value: 'Bug halaman login' } });
        fireEvent.change(document.getElementById('web-dev-ticket-description')!, { target: { value: 'Tombol login tidak merespon.' } });
        await user.click(screen.getByRole('button', { name: /kirim tiket web dev/i }));

        await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
        expect(lastPostedFormData().get('requesterId')).toBe('user-77');
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/tickets/T-9'));
    });

    it('retains the scoped draft when the server rejects the ticket', async () => {
        seedDraft('oracle-request', { title: 'Gagal login Oracle', description: 'Error ORA-01017 saat login.' });
        mockedPost.mockRejectedValueOnce({ response: { data: { message: 'Server error' } } });
        renderPage('/client/create?type=oracle-request');

        expect(document.getElementById('oracle-ticket-title')).toHaveValue('Gagal login Oracle');
        expect(screen.getByText(/draf tersimpan/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /kirim tiket oracle/i }));

        await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByRole('button', { name: /kirim tiket oracle/i })).not.toBeDisabled());
        expect(localStorage.getItem('ticket-draft-oracle-request')).not.toBeNull();
        expect(document.getElementById('oracle-ticket-title')).toHaveValue('Gagal login Oracle');
        expect(screen.queryByTestId('location')).not.toBeInTheDocument();
    });

    it('autosaves the type-scoped draft after the existing 2-second debounce', () => {
        vi.useFakeTimers();
        renderPage('/client/create?type=mobile-dev-request');
        fireEvent.change(document.getElementById('mobile-dev-ticket-title')!, { target: { value: 'App crash di Android' } });

        act(() => { vi.advanceTimersByTime(1_999); });
        expect(localStorage.getItem('ticket-draft-mobile-dev-request')).toBeNull();
        act(() => { vi.advanceTimersByTime(1); });
        const saved = JSON.parse(localStorage.getItem('ticket-draft-mobile-dev-request') ?? '{}');
        expect(saved.title).toBe('App crash di Android');
        expect(localStorage.getItem('ticket-draft-service')).toBeNull();
    });

    it('clears the draft from the draft status action', () => {
        seedDraft('service', { title: 'Printer macet', description: 'Kertas tersangkut terus.' });
        renderPage('/client/create?type=service');
        fireEvent.click(screen.getByRole('button', { name: /hapus draf/i }));
        expect(localStorage.getItem('ticket-draft-service')).toBeNull();
        expect(document.getElementById('service-ticket-title')).toHaveValue('');
    });
});
