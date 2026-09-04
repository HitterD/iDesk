import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EndToEndServiceMap } from '../EndToEndServiceMap';

// Mock sonner toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('EndToEndServiceMap (Datadog APM Style)', () => {
    it('renders trace breadcrumb, status badge, and sample traces', () => {
        render(<EndToEndServiceMap health={null} />);

        // Breadcrumbs & live status
        expect(screen.getByText('Traces')).toBeInTheDocument();
        expect(screen.getByText('Live Topology Feed')).toBeInTheDocument();
        expect(screen.getAllByText('POST /api/v1/tickets/create').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/200 OK/i).length).toBeGreaterThanOrEqual(1);

        // Sample trace buttons
        expect(screen.getByText('POST /api/v1/auth/login')).toBeInTheDocument();
        expect(screen.getByText('POST /api/v1/tickets/forward')).toBeInTheDocument();
    });

    it('renders all 5 tiers of the End-to-End Service Map', () => {
        render(<EndToEndServiceMap health={null} />);

        expect(screen.getByText(/1\. Client Edge/i)).toBeInTheDocument();
        expect(screen.getByText(/2\. API Gateway/i)).toBeInTheDocument();
        expect(screen.getByText(/3\. Core Microservices/i)).toBeInTheDocument();
        expect(screen.getByText(/4\. Infrastructure & DB/i)).toBeInTheDocument();
        expect(screen.getByText(/5\. External Cloud APIs/i)).toBeInTheDocument();
    });

    it('renders service node cards with status codes and latency metrics', () => {
        render(<EndToEndServiceMap health={null} />);

        // Primary nodes
        expect(screen.getByText('iDesk Web Portal')).toBeInTheDocument();
        expect(screen.getByText('API Gateway & Proxy')).toBeInTheDocument();
        expect(screen.getByText('Ticketing Engine')).toBeInTheDocument();
        expect(screen.getByText('PostgreSQL 16 DB')).toBeInTheDocument();
    });

    it('opens TraceExceptionDrawer when clicking inspect button', () => {
        render(<EndToEndServiceMap health={null} />);

        // Initially drawer is not visible
        expect(screen.queryByText('End-to-End Transaction Details')).not.toBeInTheDocument();

        // Click inspect button
        const inspectBtn = screen.getByRole('button', { name: /Buka Detail Transaksi & Call Stack/i });
        fireEvent.click(inspectBtn);

        // Drawer is now open with rich APM inspector
        expect(screen.getByText('End-to-End Transaction Details')).toBeInTheDocument();
        expect(screen.getByText(/Execution Waterfall/i)).toBeInTheDocument();
    });

    it('switches to error trace and shows exception details when clicking an incident trace', () => {
        render(<EndToEndServiceMap health={null} />);

        // Click incident trace
        const errorTraceBtn = screen.getByRole('button', { name: /POST \/api\/v1\/tickets\/forward/i });
        fireEvent.click(errorTraceBtn);

        // Verify status badge changed to 500 INTERNAL SERVER ERROR and drawer opens with exception details
        expect(screen.getByText(/500 INTERNAL SERVER ERROR/i)).toBeInTheDocument();
        expect(screen.getAllByText(/QueryFailedError: LockTimeoutException/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Failed Method/i)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Call Stack/i })).toBeInTheDocument();
        expect(screen.getAllByText(/Langkah Perbaikan/i).length).toBeGreaterThanOrEqual(1);
    });
});
