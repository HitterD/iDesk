import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduledReportsTab } from '../ScheduledReportsTab';
import api from '@/lib/api';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
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

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false },
        },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

const mockConfigs = [
    {
        id: 'cfg-1',
        name: 'Daily Summary Operations',
        reportType: 'MONTHLY_SUMMARY',
        schedule: 'DAILY',
        sendTime: '08:00',
        siteId: 'site-1',
        site: { id: 'site-1', code: 'SPI', name: 'Sepanjang' },
        recipientUserIds: ['user-1', 'user-2'],
        targetAgentCategory: null,
        isActive: true,
        lastRunAt: '2026-08-20T08:00:00.000Z',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
    },
];

const mockSites = [
    { id: 'site-1', code: 'SPI', name: 'Sepanjang' },
    { id: 'site-2', code: 'WRI', name: 'Waru' },
];

const mockRecipients = [
    { id: 'user-1', fullName: 'Bagas IT Support', email: 'bagas@idesk.com', role: 'AGENT' },
    { id: 'user-2', fullName: 'Fendy Oracle Support', email: 'fendy@idesk.com', role: 'AGENT_ORACLE' },
];

describe('ScheduledReportsTab', () => {
    it('renders scheduled reports list with stats and active configs', async () => {
        (api.get as any).mockImplementation((url: string) => {
            if (url === '/reports/scheduled') {
                return Promise.resolve({ data: { success: true, data: mockConfigs } });
            }
            if (url === '/sites/active') {
                return Promise.resolve({ data: mockSites });
            }
            return Promise.resolve({ data: [] });
        });

        render(<ScheduledReportsTab canManage={true} currentSiteId="site-1" />, {
            wrapper: createWrapper(),
        });

        expect(await screen.findByText('Daily Summary Operations')).toBeInTheDocument();
        expect(screen.getByText('Active Schedules')).toBeInTheDocument();
        expect(screen.getByText('New Schedule')).toBeInTheDocument();
    });

    it('opens create modal with modern recipient picker and search filter', async () => {
        const user = userEvent.setup();
        (api.get as any).mockImplementation((url: string) => {
            if (url === '/reports/scheduled') {
                return Promise.resolve({ data: { success: true, data: mockConfigs } });
            }
            if (url === '/sites/active') {
                return Promise.resolve({ data: mockSites });
            }
            if (url.startsWith('/reports/scheduled/recipients')) {
                return Promise.resolve({ data: { success: true, data: mockRecipients } });
            }
            return Promise.resolve({ data: [] });
        });

        render(<ScheduledReportsTab canManage={true} currentSiteId="site-1" />, {
            wrapper: createWrapper(),
        });

        const newScheduleBtn = await screen.findByText('New Schedule');
        await user.click(newScheduleBtn);

        expect(await screen.findByText('New Scheduled Report')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Filter agents by name or email...')).toBeInTheDocument();
        expect(await screen.findByText('Bagas IT Support')).toBeInTheDocument();
        expect(await screen.findByText('Fendy Oracle Support')).toBeInTheDocument();
    });
});
