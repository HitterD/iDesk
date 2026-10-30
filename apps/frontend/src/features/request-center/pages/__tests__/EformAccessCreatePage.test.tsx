import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EformAccessCreatePage } from '../EformAccessCreatePage';
import { EformStatusPipeline, EFormStatus } from '../../components/eform/EformStatusPipeline';

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url.includes('/users/me')) {
        return Promise.resolve({
          data: {
            id: 'user-1',
            fullName: 'Bagas Test User',
            department: { id: 'dept-1', name: 'Information Technology', code: 'IT' },
            departmentId: 'dept-1',
          },
        });
      }
      if (url.includes('/departments')) {
        return Promise.resolve({
          data: [
            { id: 'dept-1', name: 'Information Technology', code: 'IT' },
            { id: 'dept-2', name: 'Human Resources', code: 'HR' },
          ],
        });
      }
      if (url.includes('/users/approvers')) {
        return Promise.resolve({
          data: [
            { id: 'mgr-1', fullName: 'Manager One', jobTitle: 'IT Manager', department: { name: 'IT' } },
          ],
        });
      }
      if (url.includes('/eform-requests/vpn-terms') || url.includes('/eform-request/terms')) {
        return Promise.resolve({ data: { terms: '<p>Syarat dan ketentuan VPN</p>' } });
      }
      if (url.includes('/eform-request/nas/servers')) {
        return Promise.resolve({
          data: [
            { id: 'JKT', name: 'Synology JKT', location: 'Jakarta', host: '10.11.2.6', port: 30001 },
            { id: 'KRW', name: 'Synology KRW', location: 'Karawang', host: '10.12.2.6', port: 30001 },
            { id: 'SMG', name: 'Synology SMG', location: 'Semarang', host: '10.14.2.16', port: 30001 },
            { id: 'SPJ', name: 'Synology SPJ', location: 'Sepanjang', host: '192.168.2.16', port: 30001 },
          ],
        });
      }
      if (url.includes('/eform-request/nas/status')) {
        return Promise.resolve({
          data: [
            { serverId: 'SPJ', serverName: 'Synology SPJ', lastSyncedAt: '2026-09-21T21:00:00.000Z', isSyncing: false, totalFolders: 142 },
            { serverId: 'JKT', serverName: 'Synology JKT', lastSyncedAt: null, isSyncing: false, totalFolders: 0 },
          ],
        });
      }
      if (url.includes('/eform-request/req-prev-123')) {
        return Promise.resolve({
          data: {
            id: 'req-prev-123-abcdef',
            formType: 'FLASHDISK',
            status: 'CONFIRMED',
            requesterName: 'Bagas Test User',
            requesterDepartment: 'IT Department',
            formData: {
              kebutuhanAkses: 'Remote PC Kantor',
              dariTanggal: '2026-01-01',
              sampaiTanggal: '2026-02-01',
              hostname: 'PC-RENEW-01',
              accessLevel: 'READ_WRITE',
              flashdiskInfo: 'SanDisk Extreme 64GB',
            },
            createdAt: '2026-01-01T08:00:00.000Z',
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn((url: string, body?: any) => {
      if (url.includes('/eform-request/nas/browse')) {
        return Promise.resolve({
          data: {
            success: true,
            serverId: body?.serverId || 'SPJ',
            path: body?.path,
            folders: [
              { name: 'Dept_Finance', path: '/volume1/Dept_Finance', isDir: true },
              { name: 'Dept_ICT', path: '/volume1/Dept_ICT', isDir: true },
            ],
          },
        });
      }
      if (url.includes('/eform-request/nas/search')) {
        return Promise.resolve({
          data: {
            success: true,
            serverId: body?.serverId || 'SPJ',
            query: body?.query,
            folders: [
              { name: 'ICT_Support', path: '/sja/SJA SPJ/ICT/ICT_Support', isDir: true },
            ],
          },
        });
      }
      if (url.includes('/eform-request/nas/sync')) {
        return Promise.resolve({
          data: {
            success: true,
            serverId: body?.serverId || 'SPJ',
            isSyncing: true,
            message: 'Sinkronisasi dimulai di latar belakang',
          },
        });
      }
      return Promise.resolve({ data: { id: 'req-new-123' } });
    }),
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

  it('switches to Flashdisk access form with specific inputs, templates, and duration presets', () => {
    renderPage();

    // Click Akses Flashdisk
    fireEvent.click(screen.getByText('Akses Flashdisk'));

    // Hostname and Flashdisk info fields
    expect(screen.getByPlaceholderText('Contoh: PC-ACC-01 atau NB-MKT-04')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Contoh: SanDisk Cruzer Blade 32GB (S/N: 48921)')).toBeInTheDocument();

    // Tipe Akses USB buttons
    expect(screen.getByText(/Read Only \(Hanya Baca\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Read & Write \(Baca & Tulis\)/i)).toBeInTheDocument();

    // Reason template chips for Flashdisk
    expect(screen.getByText('+ Transfer data file berukuran besar antar PC/mesin offline')).toBeInTheDocument();

    // Flexible presets for Flashdisk (+1 Hari, +1 Minggu)
    expect(screen.getByText('+1 Hari')).toBeInTheDocument();
    expect(screen.getByText('+1 Minggu')).toBeInTheDocument();
    expect(screen.getByText('+12 Bln (1 Thn)')).toBeInTheDocument();
  });

  it('allows toggling USB access level between Read Only and Read & Write', () => {
    renderPage();

    fireEvent.click(screen.getByText('Akses Flashdisk'));

    const readWriteBtn = screen.getByText(/Read & Write \(Baca & Tulis\)/i).closest('button')!;
    fireEvent.click(readWriteBtn);

    // Read & Write option is now active
    expect(readWriteBtn.className).toContain('border-primary');
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

  it('pre-populates form data when renewFrom query parameter is supplied', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/eform-access/new?renewFrom=req-prev-123']}>
          <EformAccessCreatePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for renewal banner to appear
    expect(await screen.findByText(/Mode Perpanjangan Akses:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/#REQ-PREV/i).length).toBeGreaterThanOrEqual(1);

    // Verify form type switched to Flashdisk automatically
    expect(screen.getByPlaceholderText('Contoh: PC-ACC-01 atau NB-MKT-04')).toHaveValue('PC-RENEW-01');
    expect(screen.getByPlaceholderText('Contoh: SanDisk Cruzer Blade 32GB (S/N: 48921)')).toHaveValue('SanDisk Extreme 64GB');

    // Verify reason was prefilled with template
    const textarea = screen.getByPlaceholderText(/Tuliskan alasan keperluan pengajuan akses ini/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Perpanjangan akses FLASHDISK dari pengajuan sebelumnya (#REQ-PREV)');
  });

  it('auto-fills department from user profile and allows selecting a different department from dropdown', async () => {
    renderPage();

    // The department should be prefilled with user's profile department
    await waitFor(() => {
      expect(screen.getAllByText('Information Technology').length).toBeGreaterThan(0);
    });

    // Find the department combobox trigger button
    const deptCombobox = screen.getByRole('combobox', { name: /Information Technology/i });
    expect(deptCombobox).toBeInTheDocument();

    // Click to open the department dropdown
    fireEvent.click(deptCombobox);

    // Dropdown should show options including 'Human Resources'
    const hrOption = screen.getByRole('button', { name: /Human Resources/i });
    expect(hrOption).toBeInTheDocument();

    // Select 'Human Resources'
    fireEvent.click(hrOption);

    // Selected department should now be 'Human Resources'
    await waitFor(() => {
      expect(screen.getAllByText('Human Resources').length).toBeGreaterThan(0);
    });
  });

  it('renders two-tier layout for access types separating connectivity and account/storage services', () => {
    renderPage();

    expect(screen.getByText('Konektivitas & Perangkat Kantor')).toBeInTheDocument();
    expect(screen.getByText('Akun Dinas & Penyimpanan Data')).toBeInTheDocument();
  });

  it('switches to Request Email tab, shows email fields with @kapalapi.co.id and supports Permanen', () => {
    renderPage();

    // Click Request Email tab
    const emailTab = screen.getByText('Request Email');
    expect(emailTab).toBeInTheDocument();
    fireEvent.click(emailTab);

    // Email inputs should be rendered
    expect(screen.getByText('Usulan Nama Email')).toBeInTheDocument();
    expect(screen.getByText('@kapalapi.co.id')).toBeInTheDocument();
    expect(screen.getByText('Personal / Karyawan')).toBeInTheDocument();
    expect(screen.getByText('Sharing / Departemen')).toBeInTheDocument();

    // Check placeholders and guidance examples
    const emailInput = screen.getByPlaceholderText('Contoh: budi.santoso');
    expect(emailInput).toBeInTheDocument();

    // Verify quick example buttons exist
    const personalExampleBtn = screen.getByTitle('Gunakan contoh nama email perorangan');
    const sharingExampleBtn = screen.getByTitle('Gunakan contoh nama email sharing departemen');
    expect(personalExampleBtn).toBeInTheDocument();
    expect(sharingExampleBtn).toBeInTheDocument();

    // Clicking sharing example sets proposed email and switches type
    fireEvent.click(sharingExampleBtn);
    expect(emailInput).toHaveValue('admin.ict');
    expect(screen.getByText(/Preview: admin\.ict@kapalapi\.co\.id/i)).toBeInTheDocument();

    // Clicking personal example sets proposed email
    fireEvent.click(personalExampleBtn);
    expect(emailInput).toHaveValue('budi.santoso');
    expect(screen.getByText(/Preview: budi\.santoso@kapalapi\.co\.id/i)).toBeInTheDocument();

    // Permanen option should be available
    expect(screen.getByRole('button', { name: 'Permanen' })).toBeInTheDocument();
  });

  it('switches to Synology NAS tab, supports multi-server selection, folder browsing, access level customization, and Permanen', async () => {
    renderPage();

    // Click Synology NAS tab
    const nasTab = screen.getByText('Synology NAS');
    expect(nasTab).toBeInTheDocument();
    fireEvent.click(nasTab);

    // NAS multi-server options should be rendered
    expect(screen.getByText(/Lokasi Server Synology NAS/i)).toBeInTheDocument();
    expect(screen.getByText('Synology JKT')).toBeInTheDocument();
    expect(screen.getByText('Synology KRW')).toBeInTheDocument();
    expect(screen.getByText('Synology SMG')).toBeInTheDocument();
    expect(screen.getByText('Synology SPJ')).toBeInTheDocument();

    // Permanen option should be available
    expect(screen.getByRole('button', { name: 'Permanen' })).toBeInTheDocument();

    // Input a manual path for the selected server
    const pathInput = screen.getByPlaceholderText(/Contoh: \/Sharing\/Dept_Keuangan atau Data_Arsip_2026/i);
    fireEvent.change(pathInput, { target: { value: '/volume1/Dept_Finance' } });

    // Submit manual path
    const addPathBtn = screen.getByRole('button', { name: /Tambah Folder/i });
    fireEvent.click(addPathBtn);

    // Summary table should now show Dept_Finance
    await waitFor(() => {
      expect(screen.getByText(/Daftar Folder yang Diajukan/i)).toBeInTheDocument();
      expect(screen.getByText('Tingkat Hak Akses')).toBeInTheDocument();
      expect(screen.getAllByText('/volume1/Dept_Finance').length).toBeGreaterThanOrEqual(1);
    });

    // Default access level is Read Only, toggle to Read & Write in table
    const rwButtons = screen.getAllByRole('button', { name: /Read & Write/i });
    expect(rwButtons.length).toBeGreaterThan(0);
    fireEvent.click(rwButtons[0]);

    // Also select another server (KRW) to test multi-server selection
    fireEvent.click(screen.getByText('Synology KRW'));
    await waitFor(() => {
      expect(screen.getByText(/Karawang \(10.12.2.6\)/i)).toBeInTheDocument();
    });
  });

  it('supports manual path input fallback for Synology NAS servers', async () => {
    renderPage();

    // Click Synology NAS tab
    fireEvent.click(screen.getByText('Synology NAS'));

    // Select JKT server in addition to default
    fireEvent.click(screen.getByText('Synology JKT'));

    // Click Input Path Manual button
    const manualBtns = await screen.findAllByRole('button', { name: /Input Path Manual/i });
    expect(manualBtns.length).toBeGreaterThan(0);
    fireEvent.click(manualBtns[0]);

    // Input path manually
    const pathInput = screen.getByPlaceholderText(/Contoh: \/Sharing\/Dept_Keuangan atau Data_Arsip_2026/i);
    fireEvent.change(pathInput, { target: { value: '/volume1/Accounting_Archive' } });

    // Submit manual path
    const addPathBtn = screen.getByRole('button', { name: /Tambah Folder/i });
    fireEvent.click(addPathBtn);

    // Check that it's added to summary table
    await waitFor(() => {
      expect(screen.getByText('/volume1/Accounting_Archive')).toBeInTheDocument();
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });
  });

  it('displays official mascots for Email and Synology NAS with contextual guidance', async () => {
    renderPage();

    // 1. Switch to Request Email
    fireEvent.click(screen.getByText('Request Email'));

    // Check Mascot Email
    const emailMascotImg = screen.getByAltText('Maskot Email Kapal Api');
    expect(emailMascotImg).toBeInTheDocument();
    expect(emailMascotImg).toHaveAttribute('src', '/characters/mascot-mail.png');
    expect(screen.getByText('Layanan Email Perusahaan')).toBeInTheDocument();
    expect(screen.getByText('Pembuatan Akun Email')).toBeInTheDocument();

    // 2. Switch to Synology NAS
    fireEvent.click(screen.getByText('Synology NAS'));

    // Check Mascot Synology
    const synologyMascotImg = screen.getByAltText('Maskot Synology NAS');
    expect(synologyMascotImg).toBeInTheDocument();
    expect(synologyMascotImg).toHaveAttribute('src', '/characters/mascot-synology.png');
    expect(screen.getByText('Layanan File Server & NAS')).toBeInTheDocument();
    expect(screen.getByText('Akses Shared Folder NAS')).toBeInTheDocument();
  });

  it('renders screenshot upload dropzone with guidelines and paste tip', async () => {
    renderPage();

    // Click Synology NAS tab
    fireEvent.click(screen.getByText('Synology NAS'));

    // Check screenshot dropzone
    expect(await screen.findByText(/Unggah Screenshot Bukti Folder/i)).toBeInTheDocument();
    expect(screen.getByText(/Tarik & letakkan screenshot di sini/i)).toBeInTheDocument();
    expect(screen.getByText(/Ctrl \+ V/i)).toBeInTheDocument();
  });

  it('allows adding multiple manual folder paths across different servers and updating access level', async () => {
    renderPage();

    // Click Synology NAS tab
    fireEvent.click(screen.getByText('Synology NAS'));

    // Add folder on SPJ
    const pathInput = screen.getByPlaceholderText(/Contoh: \/Sharing\/Dept_Keuangan atau Data_Arsip_2026/i);
    fireEvent.change(pathInput, { target: { value: '/sja/Departemen_Keuangan' } });

    const addBtn = screen.getByRole('button', { name: /Tambah Folder/i });
    fireEvent.click(addBtn);

    // Verify folder appears in table
    await waitFor(() => {
      expect(screen.getByText('/sja/Departemen_Keuangan')).toBeInTheDocument();
      expect(screen.getAllByText('SPJ').length).toBeGreaterThanOrEqual(1);
    });

    // Select JKT server
    fireEvent.click(screen.getByText('Synology JKT'));

    // Add folder on JKT
    fireEvent.change(pathInput, { target: { value: '/sja/Dept_Marketing' } });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('/sja/Dept_Marketing')).toBeInTheDocument();
    });
  });

  it('displays empty state guidance when no folders are selected', async () => {
    renderPage();

    // Click Synology NAS tab
    fireEvent.click(screen.getByText('Synology NAS'));

    // Summary table should show empty state
    expect(await screen.findByText(/Belum ada folder manual yang ditambahkan/i)).toBeInTheDocument();
  });
  it('renders Synology account status options and direct-to-ICT notice', async () => {
    renderPage();

    // Click Synology NAS tab
    fireEvent.click(screen.getByText('Synology NAS'));

    // Verify account status buttons
    expect(await screen.findByText('Status Akun Synology')).toBeInTheDocument();
    expect(screen.getByText('Belum Memiliki Akun')).toBeInTheDocument();
    expect(screen.getByText('Sudah Memiliki Akun')).toBeInTheDocument();

    // Verify direct-to-ICT notice replaces manager selector
    expect(screen.getByText(/Verifikasi Langsung Tim ICT/i)).toBeInTheDocument();
  });

  it('toggles existing-account mode and displays prefilled editable username', async () => {
    renderPage();

    // Click Synology NAS tab
    fireEvent.click(screen.getByText('Synology NAS'));

    // Click "Sudah Memiliki Akun"
    const existingAccountBtn = await screen.findByText('Sudah Memiliki Akun');
    fireEvent.click(existingAccountBtn);

    // Verify account name input is displayed and prefilled from user
    const accountInput = screen.getByLabelText(/Nama Akun Synology Anda/i) as HTMLInputElement;
    expect(accountInput).toBeInTheDocument();
    expect(accountInput.value).toBe('bagas.test.user');

    // Edit account name
    fireEvent.change(accountInput, { target: { value: 'bagas.custom' } });
    expect(accountInput.value).toBe('bagas.custom');
  });

  it('renders 3-step pipeline for Synology NAS vs 4-step for VPN', () => {
    const { rerender } = render(
      <EformStatusPipeline currentStatus={EFormStatus.PENDING_ICT} formType="SYNOLOGY_NAS" />
    );

    // For Synology NAS: Diajukan, Tim ICT, Selesai (3 steps, skips Atasan)
    expect(screen.getByText('Diajukan')).toBeInTheDocument();
    expect(screen.getByText('Tim ICT')).toBeInTheDocument();
    expect(screen.getByText('Selesai')).toBeInTheDocument();
    expect(screen.queryByText('Atasan')).not.toBeInTheDocument();

    // For VPN: Diajukan, Atasan, Tim ICT, Selesai (4 steps)
    rerender(<EformStatusPipeline currentStatus={EFormStatus.PENDING_MANAGER} formType="VPN" />);
    expect(screen.getByText('Atasan')).toBeInTheDocument();
  });
});
