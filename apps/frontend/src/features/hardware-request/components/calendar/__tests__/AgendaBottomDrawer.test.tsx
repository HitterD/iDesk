import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AgendaBottomDrawer } from '../AgendaBottomDrawer';
import type { CalendarEventData } from '../../../types/calendar.types';

const events: CalendarEventData[] = [
  { scheduleId: 's1', requestId: 'r1', requestNumber: 'HR-044', siteName: 'Gedung A', technicianName: 'Budi', status: 'CONFIRMED',   scheduledAt: '2026-04-08T09:00:00.000Z' },
  { scheduleId: 's2', requestId: 'r2', requestNumber: 'HR-045', siteName: 'Gedung B', technicianName: 'Andi', status: 'IN_PROGRESS', scheduledAt: '2026-04-08T14:00:00.000Z' },
];
const wrap = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe('AgendaBottomDrawer', () => {
  it('renders nothing when closed', () => {
    render(<AgendaBottomDrawer open={false} date={new Date('2026-04-08')} events={events} selectedEventId={null} onSelectEvent={() => {}} onClose={() => {}} />, { wrapper: wrap });
    expect(screen.queryByText('HR-044')).not.toBeInTheDocument();
  });
  it('renders events when open', () => {
    render(<AgendaBottomDrawer open={true} date={new Date('2026-04-08')} events={events} selectedEventId={null} onSelectEvent={() => {}} onClose={() => {}} />, { wrapper: wrap });
    expect(screen.getByText('HR-044')).toBeInTheDocument();
    expect(screen.getByText('HR-045')).toBeInTheDocument();
  });
  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    render(<AgendaBottomDrawer open={true} date={new Date('2026-04-08')} events={events} selectedEventId={null} onSelectEvent={() => {}} onClose={onClose} />, { wrapper: wrap });
    await userEvent.click(screen.getByRole('button', { name: /tutup/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('calls onSelectEvent when compact card clicked', async () => {
    const onSelectEvent = vi.fn();
    render(<AgendaBottomDrawer open={true} date={new Date('2026-04-08')} events={events} selectedEventId="s1" onSelectEvent={onSelectEvent} onClose={() => {}} />, { wrapper: wrap });
    await userEvent.click(screen.getByText('HR-045'));
    expect(onSelectEvent).toHaveBeenCalledWith('s2');
  });
});