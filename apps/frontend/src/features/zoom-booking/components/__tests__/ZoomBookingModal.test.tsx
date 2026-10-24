import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ZoomBookingModal } from '../ZoomBookingModal';
import type { ZoomAccount } from '../types';

beforeEach(() => {
    if (!window.matchMedia) {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    }
    if (!('ResizeObserver' in globalThis)) {
        (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        };
    }
});

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const accounts: ZoomAccount[] = [
    {
        id: 'z1',
        name: 'Zoom Utama',
        email: 'z@x.com',
        accountType: 'MASTER',
        displayOrder: 1,
        colorHex: '#3b82f6',
        isActive: true,
        createdAt: '',
        updatedAt: '',
    },
];

describe('ZoomBookingModal', () => {
    it('renders only one close button (no duplicate X)', () => {
        render(
            <ZoomBookingModal
                open
                onClose={vi.fn()}
                mode="booking"
                zoomAccountId="z1"
                accounts={accounts}
            />,
            { wrapper }
        );

        // Accessible-name "Tutup" should match exactly once
        const closeButtons = screen.getAllByRole('button', { name: /^tutup$/i });
        expect(closeButtons).toHaveLength(1);
    });

    it('calls onClose when the close button is clicked', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <ZoomBookingModal
                open
                onClose={onClose}
                mode="booking"
                zoomAccountId="z1"
                accounts={accounts}
            />,
            { wrapper }
        );
        await user.click(screen.getByRole('button', { name: /^tutup$/i }));
        expect(onClose).toHaveBeenCalled();
    });

    it('summarises the chosen slot (date, start-end, duration) when a start time is preselected', () => {
        render(
            <ZoomBookingModal
                open
                onClose={vi.fn()}
                mode="booking"
                zoomAccountId="z1"
                preselectedDate="2026-09-03"
                preselectedTime="09:00"
                accounts={accounts}
            />,
            { wrapper }
        );

        // Default one hour after the preselected start, shown in the picker summary.
        expect(screen.getByRole('status')).toHaveTextContent(/kamis, 3 sep · 09\.00–10\.00 WIB · 1 jam/i);
        expect(screen.getByRole('combobox', { name: /^Jam mulai/ })).toHaveValue('09.00');
        expect(screen.getByRole('combobox', { name: 'Jam selesai' })).toHaveValue('10.00');
    });
});
