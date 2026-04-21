import { render, screen } from '@testing-library/react';
import { StatsStrip } from '../StatsStrip';

describe('StatsStrip', () => {
  it('renders all four stat values', () => {
    render(<StatsStrip scheduled={24} today={3} unscheduled={5} rescheduleRequested={2} />);
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
  it('renders stat labels', () => {
    render(<StatsStrip scheduled={0} today={0} unscheduled={0} rescheduleRequested={0} />);
    expect(screen.getByText('Total Scheduled')).toBeInTheDocument();
    expect(screen.getByText("Today's Schedule")).toBeInTheDocument();
    expect(screen.getByText('Unscheduled')).toBeInTheDocument();
    expect(screen.getByText('Reschedule Req.')).toBeInTheDocument();
  });
});