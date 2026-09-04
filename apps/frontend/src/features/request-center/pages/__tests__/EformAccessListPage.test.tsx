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

  it('renders E-Form Access page and verified request table list with PDF button', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/eform-access']}>
          <EformAccessListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('E-Form Access')).toBeInTheDocument();
    expect(screen.getByText(/Pengajuan akses VPN, website, dan jaringan/i)).toBeInTheDocument();

    // Verify table headers
    expect(screen.getByText('ID & Jenis Akses')).toBeInTheDocument();
    expect(screen.getByText('Pemohon')).toBeInTheDocument();
    expect(screen.getByText('Diajukan')).toBeInTheDocument();
    expect(screen.getByText('Berlaku Dari')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Aksi')).toBeInTheDocument();

    // Verify request row & card data rendered
    const requesterNames = await screen.findAllByText('Bagas Pratama');
    expect(requesterNames.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('IT Department').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Akses VPN').length).toBeGreaterThanOrEqual(1);

    // Verify PDF button and Detail button rendered
    expect(screen.getAllByText(/PDF F-ICT-04/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Detail').length).toBeGreaterThanOrEqual(1);
  });
});
