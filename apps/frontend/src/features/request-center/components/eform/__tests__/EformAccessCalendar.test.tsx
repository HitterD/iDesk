import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { EformAccessCalendar } from '../EformAccessCalendar';
import { EFormRequest } from '../../../api/eform-request.api';

// Generate 500 mock requests across different sites, departments, and form types
function create500MockRequests(): EFormRequest[] {
  const sites = ['SPJ', 'SMG', 'KRW', 'JTB'];
  const types: Array<'VPN' | 'WEBSITE' | 'JARINGAN' | 'FLASHDISK'> = [
    'VPN',
    'WEBSITE',
    'JARINGAN',
    'FLASHDISK',
  ];
  const depts = ['IT Department', 'Finance', 'HR', 'Production', 'Logistics'];

  return Array.from({ length: 500 }, (_, i) => {
    const site = sites[i % sites.length];
    const formType = types[i % types.length];
    const dept = depts[i % depts.length];
    const day = (i % 28) + 1;
    const dayStr = day < 10 ? `0${day}` : `${day}`;

    return {
      id: `req-${1000 + i}`,
      formType,
      status: 'CONFIRMED',
      requesterName: `User Scale ${i + 1}`,
      requesterDepartment: dept,
      formData: {
        site,
        dariTanggal: '2026-01-01',
        sampaiTanggal: `2026-09-${dayStr}`,
        kebutuhanAkses: `Akses operasional user ${i + 1}`,
      },
      createdAt: '2026-01-01T08:00:00.000Z',
    } as unknown as EFormRequest;
  });
}

describe('EformAccessCalendar - 500+ Scale & Dual Mode', () => {
  it('renders 500 requests gracefully with aggregated deadline chips and filters', () => {
    const mock500 = create500MockRequests();

    render(
      <MemoryRouter>
        <EformAccessCalendar requests={mock500} />
      </MemoryRouter>
    );

    // Filter toolbar is rendered with total count (500)
    expect(screen.getByText('Semua (500)')).toBeInTheDocument();
    expect(screen.getByText('VPN')).toBeInTheDocument();
    expect(screen.getByText('Website')).toBeInTheDocument();
    expect(screen.getByText('Jaringan')).toBeInTheDocument();
    expect(screen.getByText('Flashdisk')).toBeInTheDocument();

    // Mode switchers present
    expect(screen.getByRole('button', { name: /Kalender Tenggat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Timeline Gantt/i })).toBeInTheDocument();

    // Site and Department filter dropdowns
    expect(screen.getByLabelText(/Saring Site/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Saring Departemen/i)).toBeInTheDocument();

    // Sidebar Monitoring Tenggat is rendered
    expect(screen.getByText('Monitoring Tenggat')).toBeInTheDocument();
  });

  it('switches to Timeline Gantt mode and handles 15-item pagination across 500 users', () => {
    const mock500 = create500MockRequests();

    render(
      <MemoryRouter>
        <EformAccessCalendar requests={mock500} />
      </MemoryRouter>
    );

    // Switch to Timeline Gantt
    const ganttBtn = screen.getByRole('button', { name: /Timeline Gantt/i });
    fireEvent.click(ganttBtn);

    // Gantt scale selector should appear with exact options
    expect(screen.getByRole('button', { name: /1 Bulan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 Bulan \(Kuartal\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 Tahun/i })).toBeInTheDocument();

    // Pagination info: 500 items / 15 per page = 34 pages
    expect(screen.getByText(/Hal 1 \/ 34/i)).toBeInTheDocument();

    // Page 1 should display "User Scale 1"
    expect(screen.getByText('User Scale 1')).toBeInTheDocument();

    // Navigate to next page
    const nextBtn = screen.getByRole('button', { name: /Berikutnya/i });
    fireEvent.click(nextBtn);

    // Now on Page 2
    expect(screen.getByText(/Hal 2 \/ 34/i)).toBeInTheDocument();
    expect(screen.getByText('User Scale 16')).toBeInTheDocument();
  });

  it('filters by Site and Department dynamically and updates pagination counts', () => {
    const mock500 = create500MockRequests();

    render(
      <MemoryRouter>
        <EformAccessCalendar requests={mock500} />
      </MemoryRouter>
    );

    // Switch to Gantt view
    fireEvent.click(screen.getByRole('button', { name: /Timeline Gantt/i }));

    // Filter by Site: SPJ (500 / 4 = 125 items)
    const siteSelect = screen.getByLabelText(/Saring Site/i);
    fireEvent.change(siteSelect, { target: { value: 'SPJ' } });

    // 125 items / 15 per page = 9 pages
    expect(screen.getByText(/Hal 1 \/ 9/i)).toBeInTheDocument();

    // Filter by Department: IT Department (125 / 5 = 25 items)
    const deptSelect = screen.getByLabelText(/Saring Departemen/i);
    fireEvent.change(deptSelect, { target: { value: 'IT Department' } });

    // 25 items / 15 per page = 2 pages
    expect(screen.getByText(/Hal 1 \/ 2/i)).toBeInTheDocument();
  });

  it('opens slide-over drawer when clicking a Gantt user row and displays detail / perpanjangan actions', () => {
    const mock500 = create500MockRequests();
    const handleOpenDetail = vi.fn();

    render(
      <MemoryRouter>
        <EformAccessCalendar requests={mock500} onOpenDetail={handleOpenDetail} />
      </MemoryRouter>
    );

    // Switch to Timeline Gantt
    fireEvent.click(screen.getByRole('button', { name: /Timeline Gantt/i }));

    // Click user row "User Scale 1"
    const userRow = screen.getByText('User Scale 1');
    fireEvent.click(userRow);

    // Slide-over drawer should be open with details
    expect(screen.getByText('Detail Tenggat Akses')).toBeInTheDocument();
    expect(screen.getByText('Ajukan Perpanjangan')).toBeInTheDocument();
    expect(screen.getByText('Buka Detail')).toBeInTheDocument();

    // Click "Buka Detail"
    const detailBtn = screen.getByText('Buka Detail');
    fireEvent.click(detailBtn);
    expect(handleOpenDetail).toHaveBeenCalledWith('req-1000');
  });
});
