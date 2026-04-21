import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HardwareRequestsBreadcrumb } from '../common/HardwareRequestsBreadcrumb';

describe('HardwareRequestsBreadcrumb', () => {
  it('renders path Hardware Requests / Permintaan / #HR-1234', () => {
    render(
      <MemoryRouter>
        <HardwareRequestsBreadcrumb currentLabel="#HR-1234" />
      </MemoryRouter>
    );
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(nav).toHaveTextContent(/hardware requests/i);
    expect(nav).toHaveTextContent(/permintaan/i);
    expect(nav).toHaveTextContent('#HR-1234');
  });

  it('root link points to /hardware-requests', () => {
    render(
      <MemoryRouter>
        <HardwareRequestsBreadcrumb currentLabel="#HR-1" />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /hardware requests/i })).toHaveAttribute('href', '/hardware-requests');
  });
});
