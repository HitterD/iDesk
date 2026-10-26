import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../lib/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));
vi.mock('../../../../stores/useAuth', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

import api from '../../../../lib/api';
import { BentoLoginPage } from '../BentoLoginPage';

const mockApi = api as unknown as { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

describe('BentoLoginPage integration', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'locks', { value: {
      request: async (_name: string, _options: unknown, callback: () => unknown) => callback(),
    }, configurable: true });
    mockApi.post.mockReset();
    mockApi.get.mockReset();
    mockApi.get.mockResolvedValue({ data: { enabled: false } });
    mockApi.post.mockImplementation((url: string) => {
      if (url === '/auth/refresh') {
        return Promise.reject(new Error('No refresh token'));
      }
      return Promise.resolve({ data: { user: { role: 'ADMIN' } } });
    });
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('shows "NIK / Email wajib diisi" when identifier is empty', async () => {
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Password'), 'something');
    await user.click(screen.getByRole('button', { name: /^masuk$/i }));
    expect(await screen.findByText(/nik \/ email wajib diisi/i)).toBeInTheDocument();
  });

  it('shows "Password wajib diisi" when password is empty', async () => {
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /^masuk$/i }));
    expect(await screen.findByText(/password wajib diisi/i)).toBeInTheDocument();
  });

  it('does not call api.post when fields are empty', async () => {
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^masuk$/i }));
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it.each([
    ['admin@example.com', 'password123'],
    ['00000024', '123456'],
  ])('calls api.post with identifier %s and password', async (email, password) => {
    mockApi.post.mockResolvedValue({ data: { user: { role: 'ADMIN' } } });
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), email);
    await user.type(screen.getByLabelText('Password'), password);
    await user.click(screen.getByRole('button', { name: /^masuk$/i }));
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email, password, rememberMe: true });
    });
  });

  it('sends rememberMe: false when "Ingat saya" is unchecked', async () => {
    mockApi.post.mockResolvedValue({ data: { user: { role: 'ADMIN' } } });
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByLabelText(/ingat saya/i)); // uncheck default
    await user.click(screen.getByRole('button', { name: /^masuk$/i }));
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@example.com',
        password: 'password123',
        rememberMe: false,
      });
    });
  });

  it('displays error from API on 401 WRONG_PASSWORD', async () => {
    mockApi.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { errorCode: 'WRONG_PASSWORD' } },
    });
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /^masuk$/i }));
    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument();
  });

  it('displays error from API on 423 lockout', async () => {
    mockApi.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 423, data: { message: 'Locked' } },
    });
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /^masuk$/i }));
    expect(await screen.findByText(/security lock active/i)).toBeInTheDocument();
  });

  it('disables submit button while loading', async () => {
    let resolveLogin: (value: unknown) => void = () => {};
    mockApi.post.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /^masuk$/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /memverifikasi/i })).toBeDisabled();
    });
    resolveLogin({ data: { user: { role: 'ADMIN' } } });
  });

  it('displays rate limit countdown banner while preserving password error on 429', async () => {
    mockApi.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { errorCode: 'WRONG_PASSWORD' } },
    });
    mockApi.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 429, headers: { 'retry-after': '30' } },
    });

    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /^masuk$/i }));

    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument();

    // Clear password and try submitting again to hit 429
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'wrongpassword2');
    await user.click(screen.getByRole('button', { name: /^masuk$/i }));

    expect(await screen.findByText(/terlalu banyak percobaan/i)).toBeInTheDocument();
    expect(screen.getByText(/tunggu 30 detik/i)).toBeInTheDocument();
    expect(screen.getByText(/incorrect password/i)).toBeInTheDocument();
  });

  it('restores rate limit countdown from localStorage when page mounts or identifier changes', async () => {
    const futureExpiry = Date.now() + 45000;
    localStorage.setItem('idesk_rl_manager@idesk.com', String(futureExpiry));

    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), 'manager@idesk.com');

    expect(await screen.findByText(/terlalu banyak percobaan/i)).toBeInTheDocument();
    expect(screen.getByText(/tunggu \d+ detik/i)).toBeInTheDocument();
  });

  it('renders Kapal Api Group, PT Santos Jaya Abadi, and iDesk branding logos', () => {
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );

    const kapalApiLogo = screen.getByAltText('Kapal Api Group');
    const sjaLogo = screen.getByAltText('PT Santos Jaya Abadi');
    const ideskLogo = screen.getByAltText('iDesk');

    expect(kapalApiLogo).toBeInTheDocument();
    expect(sjaLogo).toBeInTheDocument();
    expect(ideskLogo).toBeInTheDocument();
  });

  it('shows "Masuk dengan iPop" only when the backend enables it', async () => {
    mockApi.get.mockResolvedValue({ data: { enabled: true } });
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /masuk dengan ipop/i })).toBeInTheDocument();
    expect(mockApi.get).toHaveBeenCalledWith('/auth/oidc/status', expect.anything());
  });

  it('hides "Masuk dengan iPop" when it is not configured', async () => {
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /masuk dengan ipop/i })).not.toBeInTheDocument();
  });

  it('explains an unlinked iPop account from ?sso_error', async () => {
    render(
      <MemoryRouter initialEntries={['/login?sso_error=ipop_not_linked']}>
        <BentoLoginPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/akun idesk belum terhubung/i)).toBeInTheDocument();
  });
});
