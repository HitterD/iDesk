import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EformAccessCreatePage } from '../EformAccessCreatePage';

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url.includes('/users/approvers')) {
        return Promise.resolve({
          data: [
            { id: 'mgr-1', fullName: 'Manager One', jobTitle: 'IT Manager', department: { name: 'IT' } },
          ],
        });
      }
      if (url.includes('/eform-requests/vpn-terms')) {
        return Promise.resolve({ data: { terms: '<p>Syarat dan ketentuan VPN</p>' } });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn(() => Promise.resolve({ data: { id: 'req-new-123' } })),
  },
}));

vi.mock('@/stores/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', fullName: 'Bagas Test User', departmentId: 'IT Department', role: 'USER' },
  }),
}));

describe('EformAccessCreatePage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/eform-access/new']}>
          <EformAccessCreatePage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders streamlined form with clear sections and no visual clutter', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Ajukan Akses' })).toBeInTheDocument();
    expect(screen.getByText('Jenis Akses')).toBeInTheDocument();
    expect(screen.getByText('Identitas Pemohon')).toBeInTheDocument();
    expect(screen.getByText('Periode Akses')).toBeInTheDocument();
    expect(screen.getByText('Alasan Pengajuan')).toBeInTheDocument();
  });

  it('renders VPN dropdown options: Remote PC Kantor and Akses Jaringan Kantor', async () => {
    renderPage();

    // Default selected option should be Remote PC Kantor
    expect(screen.getByText('Remote PC Kantor')).toBeInTheDocument();

    // Click the dropdown combobox to open options
    const vpnTrigger = screen.getByRole('combobox', { name: /Kebutuhan Akses VPN/i });
    fireEvent.click(vpnTrigger);

    // Both options should be in the popover
    expect(screen.getAllByText('Remote PC Kantor').length).toBeGreaterThan(0);
    expect(screen.getByText('Akses Jaringan Kantor')).toBeInTheDocument();

    // Select Akses Jaringan Kantor
    fireEvent.click(screen.getByText('Akses Jaringan Kantor'));

    // Now Akses Jaringan Kantor is selected
    expect(screen.getByText('Akses Jaringan Kantor')).toBeInTheDocument();
  });

  it('supports quick duration presets for access period and enforces 12-month max on VPN', () => {
    renderPage();

    // Default VPN form should have +12 Bln (1 Thn) preset, not Permanen
    expect(screen.getByText('+1 Bln')).toBeInTheDocument();
    expect(screen.getByText('+3 Bln')).toBeInTheDocument();
    expect(screen.getByText('+6 Bln')).toBeInTheDocument();
    expect(screen.getByText('+12 Bln (1 Thn)')).toBeInTheDocument();
    expect(screen.queryByText('Permanen')).not.toBeInTheDocument();

    // Click +12 Bln (1 Thn)
    fireEvent.click(screen.getByText('+12 Bln (1 Thn)'));

    // Switch to Website
    fireEvent.click(screen.getByText('Akses Website'));
    // Website has Permanen option
    expect(screen.getByText('Permanen')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Permanen'));
    expect(screen.getByText('Kosongkan jika permanen')).toBeInTheDocument();
  });




  it('applies tailored reason template chips for VPN', () => {
    renderPage();

    const templateChip = screen.getByText('+ Work From Home (WFH) untuk remote komputer kerja kantor');
    fireEvent.click(templateChip);

    const textarea = screen.getByPlaceholderText(/Tuliskan alasan keperluan pengajuan akses ini/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Work From Home (WFH) untuk remote komputer kerja kantor');
  });

  it('switches templates when switching to Website access', () => {
    renderPage();

    // Click Akses Website
    fireEvent.click(screen.getByText('Akses Website'));

    expect(screen.getByText('+ Kebutuhan riset dan referensi materi pekerjaan')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Contoh: github.com, figma.com, stackoverflow.com')).toBeInTheDocument();
  });

  it('switches templates when switching to Network access', () => {
    renderPage();

    // Click Akses Jaringan
    fireEvent.click(screen.getByText('Akses Jaringan'));

    expect(screen.getByText('+ Koneksi ke server aplikasi & database internal kantor')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Akses subnet 192.168.1.0/i)).toBeInTheDocument();
  });

  it('requires scrolling terms and conditions before allowing agreement checkbox', async () => {
    renderPage();

    const termsContainer = await screen.findByRole('region', { name: /Isi syarat dan ketentuan/i });
    const checkbox = document.getElementById('terms') as HTMLElement;

    expect(checkbox).toBeDisabled();

    // Simulate scroll to bottom
    Object.defineProperty(termsContainer, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(termsContainer, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(termsContainer, 'scrollTop', { configurable: true, value: 300 });

    fireEvent.scroll(termsContainer);

    await waitFor(() => {
      expect(checkbox).not.toBeDisabled();
    });

    fireEvent.click(checkbox);
  });


});


