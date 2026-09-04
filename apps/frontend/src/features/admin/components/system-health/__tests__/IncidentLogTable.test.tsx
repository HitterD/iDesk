import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncidentLogTable } from '../IncidentLogTable';
import { EndToEndTrace } from '../serviceMapTypes';

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

const mockErrorTraces: EndToEndTrace[] = [
    {
        traceId: 'trace-err-500',
        operationId: 'op500',
        operationName: 'POST /api/v1/tickets/forward',
        httpMethod: 'POST',
        endpoint: 'https://idesk.santos.co.id/api/v1/tickets/forward',
        totalDurationMs: 1460,
        statusCode: 500,
        statusText: '500 INTERNAL SERVER ERROR',
        timestamp: 'Sep 03 22:45:12.363',
        clientInfo: {
            app: 'idesk-web-client',
            browser: 'Chrome 128.0',
            os: 'Windows 11',
            country: 'Indonesia',
            ip: '192.168.10.45',
        },
        spanCount: 24,
        errorCount: 1,
        activeNodes: ['idesk-web-client', 'api-gateway', 'ticketing-engine', 'postgresql-primary'],
        connections: [],
        nodeMetrics: {},
        events: [],
        exception: {
            type: 'QueryFailedError: LockTimeoutException',
            eventTime: '9/3/2026, 10:45:13 PM',
            localTime: '22:45:13',
            message: 'could not obtain lock on row in relation tickets after 1000ms',
            failedMethod: 'TicketForwardService.autoAssignAgent',
            customProperties: {},
            callStack: 'QueryFailedError: lock timeout at PostgresQueryRunner',
        },
    },
];

describe('IncidentLogTable', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('renders header, incident count, and root cause analysis from seed logs', () => {
        render(
            <IncidentLogTable
                incidents={[]}
                errorTraces={mockErrorTraces}
                onSelectTrace={vi.fn()}
            />
        );

        expect(screen.getByText(/Incident & Error Diagnostic Logs/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Tersimpan/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/QueryFailedError: LockTimeoutException/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Penyebab Masalah \(Root Cause\)/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Langkah Perbaikan \(Remediation\)/i).length).toBeGreaterThan(0);
    });

    it('filters log items when clicking date filter buttons (Hari Ini vs Kemarin)', () => {
        render(
            <IncidentLogTable
                incidents={[]}
                errorTraces={[]}
                onSelectTrace={vi.fn()}
            />
        );

        // Initially "Semua Tanggal" is active
        expect(screen.getByText(/QueryFailedError: LockTimeoutException/i)).toBeInTheDocument();
        expect(screen.getByText(/PostgreSQLConnectionPoolExhausted/i)).toBeInTheDocument();

        // Click "Hari Ini" filter
        const todayButton = screen.getByRole('button', { name: /^Hari Ini/i });
        fireEvent.click(todayButton);

        // Today items visible, yesterday items filtered out
        expect(screen.getByText(/QueryFailedError: LockTimeoutException/i)).toBeInTheDocument();
        expect(screen.queryByText(/PostgreSQLConnectionPoolExhausted/i)).not.toBeInTheDocument();

        // Click "Kemarin" filter
        const yesterdayButton = screen.getByRole('button', { name: /^Kemarin/i });
        fireEvent.click(yesterdayButton);

        // Yesterday items visible, today items filtered out
        expect(screen.getByText(/PostgreSQLConnectionPoolExhausted/i)).toBeInTheDocument();
        expect(screen.queryByText(/QueryFailedError: LockTimeoutException/i)).not.toBeInTheDocument();

        // Click back to "Semua Tanggal"
        const allDatesButton = screen.getByRole('button', { name: /^Semua Tanggal/i });
        fireEvent.click(allDatesButton);
        expect(screen.getByText(/QueryFailedError: LockTimeoutException/i)).toBeInTheDocument();
        expect(screen.getByText(/PostgreSQLConnectionPoolExhausted/i)).toBeInTheDocument();
    });

    it('filters log items when searching by keyword', () => {
        render(
            <IncidentLogTable
                incidents={[]}
                errorTraces={mockErrorTraces}
                onSelectTrace={vi.fn()}
            />
        );

        const searchInput = screen.getByPlaceholderText(/Cari service, error, atau Trace ID/i);
        fireEvent.change(searchInput, { target: { value: 'nonexistent-query' } });

        expect(screen.queryByText(/QueryFailedError: LockTimeoutException/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Tidak ada log insiden yang cocok/i)).toBeInTheDocument();
    });

    it('calls onSelectTrace when clicking Investigate in Map button', () => {
        const onSelectTraceMock = vi.fn();
        render(
            <IncidentLogTable
                incidents={[]}
                errorTraces={mockErrorTraces}
                onSelectTrace={onSelectTraceMock}
            />
        );

        const investigateButtons = screen.getAllByRole('button', { name: /Investigate in Map/i });
        expect(investigateButtons.length).toBeGreaterThan(0);
        fireEvent.click(investigateButtons[0]);

        expect(onSelectTraceMock).toHaveBeenCalled();
    });

    it('clears all logs and can reset to default seed', () => {
        render(
            <IncidentLogTable
                incidents={[]}
                errorTraces={[]}
                onSelectTrace={vi.fn()}
            />
        );

        // Clear all
        const clearBtn = screen.getByTitle('Bersihkan seluruh log');
        fireEvent.click(clearBtn);

        expect(screen.getByText(/Tidak ada log insiden yang cocok dengan filter tanggal/i)).toBeInTheDocument();

        // Reset to default seed via header reset button
        const resetBtn = screen.getByTitle('Reset data acuan insiden (Hari Ini & Kemarin)');
        fireEvent.click(resetBtn);

        expect(screen.getByText(/QueryFailedError: LockTimeoutException/i)).toBeInTheDocument();
    });
});
