import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgingTable } from '../dashboard/AgingTable';
import { MemoryRouter } from 'react-router-dom';

test('renders aging buckets as bars and flags >7-day requests red', () => {
  render(
    <MemoryRouter>
      <AgingTable
        data={[
          { bucket: '0-3', count: 10, requests: [] },
          { bucket: '3-7', count: 4, requests: [] },
          { bucket: '>7', count: 2, requests: [{ id: 'r1', requestNumber: 'HR-001', ageDays: 9, status: 'APPROVED' }] },
        ]}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/> 7 hari/i)).toBeInTheDocument();
  expect(screen.getByText('10')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /HR-001/i })).toHaveAttribute('data-bucket', '>7');
  expect(screen.getByRole('link', { name: /HR-001/i })).toHaveClass('is-overdue');
  expect(screen.getByRole('link', { name: /HR-001/i })).toHaveAttribute('href', '/hardware-requests/r1');
});
