import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgingTable } from '../dashboard/AgingTable';
import { MemoryRouter } from 'react-router-dom';

test('renders aging buckets with counts and flags red >7 days', () => {
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
  expect(screen.getByText(/> 7 hari/i).closest('tr')).toHaveClass('bg-rose-50');
  expect(screen.getByRole('link', { name: /HR-001/i })).toHaveAttribute('href', '/hardware-requests/r1');
});
