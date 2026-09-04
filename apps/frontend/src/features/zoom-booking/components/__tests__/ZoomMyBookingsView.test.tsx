import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ZoomMyBookingsView } from '../ZoomMyBookingsView';
import { format, addDays } from 'date-fns';

const mockBookings = [
    {
        id: 'b-past-1',
        title: 'Past Meeting July',
        bookingDate: '2026-07-31T00:00:00.000Z',
        startTime: '10:00',
        endTime: '11:00',
        status: 'confirmed',
        bookedByUserId: 'user-1',
        meeting: { joinUrl: 'https://zoom.us/j/past' },
        zoomAccount: { name: 'Zoom Admin 1', colorHex: '#3b82f6' },
    },
    {
        id: 'b-today-1',
        title: 'Today Meeting Important',
        bookingDate: format(new Date(), 'yyyy-MM-dd'),
        startTime: '14:00',
        endTime: '15:00',
        status: 'confirmed',
        bookedByUserId: 'user-1',
        meeting: { joinUrl: 'https://zoom.us/j/today' },
        zoomAccount: { name: 'Zoom Admin 2', colorHex: '#10b981' },
    },
    {
        id: 'b-future-1',
        title: 'Next Week Meeting',
        bookingDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '10:00',
        status: 'confirmed',
        bookedByUserId: 'user-1',
        meeting: { joinUrl: 'https://zoom.us/j/future' },
        zoomAccount: { name: 'Zoom Admin 3', colorHex: '#8b5cf6' },
    },
];

vi.mock('../../hooks', () => ({
    useMyBookings: () => ({
        data: mockBookings,
        isLoading: false,
    }),
    useCancelOwnBooking: () => ({
        mutateAsync: vi.fn(),
        isPending: false,
    }),
    useCancelBooking: () => ({
        mutateAsync: vi.fn(),
        isPending: false,
    }),
    useRescheduleOwnBooking: () => ({
        mutateAsync: vi.fn(),
        isPending: false,
    }),
    useZoomAccounts: () => ({
        data: [
            { id: 'acc-1', name: 'Zoom Admin 1', email: 'zoom1@example.com', displayOrder: 1, colorHex: '#3b82f6', isActive: true },
            { id: 'acc-2', name: 'Zoom Admin 2', email: 'zoom2@example.com', displayOrder: 2, colorHex: '#10b981', isActive: true },
        ],
        isLoading: false,
    }),
    useZoomMergedCalendar: () => ({
        data: [],
        isLoading: false,
    }),
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: 'EMPLOYEE' },
    }),
}));

function renderWithClient(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ZoomMyBookingsView', () => {
    it('defaults to Calendar view and displays calendar month header', () => {
        renderWithClient(<ZoomMyBookingsView />);

        // Should display Kalender, Matrix, and Bookingan Saya toggle buttons
        expect(screen.getByRole('button', { name: /Kalender/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Matrix Semua Akun/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Bookingan Saya/i })).toBeInTheDocument();

        // Calendar should show month navigation and today button
        expect(screen.getByRole('button', { name: /Hari Ini/i })).toBeInTheDocument();
    });

    it('allows toggling between Calendar and List view', () => {
        renderWithClient(<ZoomMyBookingsView />);

        // Switch to List view
        fireEvent.click(screen.getByRole('button', { name: /Bookingan Saya/i }));

        // Now tabs and search should appear
        expect(screen.getByRole('button', { name: /^Mendatang/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Semua/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Selesai/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Cari judul, akun Zoom/i)).toBeInTheDocument();
    });

    it('allows toggling to Matrix Semua Akun view', () => {
        renderWithClient(<ZoomMyBookingsView />);

        // Switch to Matrix view
        fireEvent.click(screen.getByRole('button', { name: /Matrix Semua Akun/i }));

        // Matrix month header and toolbar should be visible
        expect(screen.getByRole('button', { name: /Bulan berikutnya/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Bulan sebelumnya/i })).toBeInTheDocument();
    });

    it('shows count badges on tabs in list mode', () => {
        renderWithClient(<ZoomMyBookingsView defaultViewMode="list" />);

        // Mendatang tab should show count 2
        expect(screen.getByRole('button', { name: /^Mendatang\s*2/i })).toBeInTheDocument();
        // Semua tab should show count 3
        expect(screen.getByRole('button', { name: /^Semua\s*3/i })).toBeInTheDocument();
        // Selesai tab should show count 1
        expect(screen.getByRole('button', { name: /^Selesai\s*1/i })).toBeInTheDocument();
    });

    it('switches to Semua tab and renders newest date first (DESC) in list mode', () => {
        renderWithClient(<ZoomMyBookingsView defaultViewMode="list" />);

        fireEvent.click(screen.getByRole('button', { name: /^Semua/i }));

        // All titles should be in the document
        expect(screen.getByText('Next Week Meeting')).toBeInTheDocument();
        expect(screen.getByText('Today Meeting Important')).toBeInTheDocument();
        expect(screen.getByText('Past Meeting July')).toBeInTheDocument();

        // Check relative positioning: Next Week or Today should appear before Past Meeting July
        const allHeadings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
        expect(allHeadings.indexOf('Past Meeting July')).toBe(2); // Past is at bottom
    });

    it('filters meetings when search query is entered and allows clearing in list mode', () => {
        renderWithClient(<ZoomMyBookingsView defaultViewMode="list" />);

        const searchInput = screen.getByPlaceholderText(/Cari judul, akun Zoom/i);
        fireEvent.change(searchInput, { target: { value: 'Next Week' } });

        expect(screen.getByText('Next Week Meeting')).toBeInTheDocument();
        expect(screen.queryByText('Today Meeting Important')).not.toBeInTheDocument();

        const clearBtn = screen.getByTitle('Hapus pencarian');
        fireEvent.click(clearBtn);

        expect(screen.getByText('Today Meeting Important')).toBeInTheDocument();
    });
});
