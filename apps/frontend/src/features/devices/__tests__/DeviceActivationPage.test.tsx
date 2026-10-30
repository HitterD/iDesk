import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeviceActivationPage from '../DeviceActivationPage';

vi.mock('@/stores/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', employeeId: 'NIK-0042', name: 'Bagas Tyo' },
    isAuthenticated: true,
  }),
}));

describe('DeviceActivationPage', () => {
  it('renders activation code input and button', () => {
    render(
      <MemoryRouter initialEntries={['/devices/activate?code=654321']}>
        <DeviceActivationPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Aktivasi SJA Notifier/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Izinkan Perangkat Ini/i })).toBeInTheDocument();
  });
});
