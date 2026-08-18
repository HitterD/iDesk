import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EformAccessListPage } from '../EformAccessListPage';

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url.includes('/eform-request/pending-approvals')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/eform-request/my') || url.includes('/eform-request/all')) {
        return Promise.resolve({
          data: [
            {
              id: 'req-001-abcdef123',
              formType: 'VPN',
              status: 'CONFIRMED',
              requesterName: 'Bagas Pratama',
              requesterDepartment: 'IT Department',
              formData: {
                dariTanggal: '2026-01-23',
                sampaiTanggal: '2027-01-23',
                kebutuhanAkses: 'Remote PC Kantor',
              },
              createdAt: '2026-01-23T08:00:00.000Z',
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    }),
  },
}));

vi.mock('@/stores/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', fullName: 'Bagas Test User', role: 'ADMIN' },
  }),
}));

describe('EformAccessListPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders E-Form Access page and verified request card with PDF button', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/eform-access']}>
          <EformAccessListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('E-Form Access')).toBeInTheDocument();
    expect(screen.getByText(/Pengajuan akses VPN, website, dan jaringan/i)).toBeInTheDocument();

    // Verify card rendered
    const requesterName = await screen.findByText('Bagas Pratama');
    expect(requesterName).toBeInTheDocument();

    // Verify PDF button rendered on confirmed card
    expect(screen.getByText('PDF F-ICT-04')).toBeInTheDocument();
  });
});
