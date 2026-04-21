import { render, screen } from '@testing-library/react';
import { EventChipMedium } from '../EventChipMedium';
import type { CalendarEventData } from '../../../types/calendar.types';

const event: CalendarEventData = {
  scheduleId: 's1', requestId: 'r1', requestNumber: 'HR-2024-044',
  siteName: 'Gedung A', technicianName: 'Budi Santoso',
  status: 'CONFIRMED', scheduledAt: '2026-04-08T09:00:00.000Z',
};

describe('EventChipMedium', () => {
  it('renders request number', () => {
    render(<EventChipMedium event={event} />);
    expect(screen.getByText('HR-2024-044')).toBeInTheDocument();
  });
  it('renders technician name', () => {
    render(<EventChipMedium event={event} />);
    expect(screen.getByText(/Budi Santoso/)).toBeInTheDocument();
  });
  it('renders abbreviated status badge for CONFIRMED', () => {
    render(<EventChipMedium event={event} />);
    expect(screen.getByText('CFM')).toBeInTheDocument();
  });
  it('falls back gracefully for unknown status', () => {
    render(<EventChipMedium event={{ ...event, status: 'UNKNOWN' }} />);
    expect(screen.getByText('HR-2024-044')).toBeInTheDocument();
  });
});