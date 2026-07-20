import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../lib/api', () => ({
  default: { post: vi.fn() },
}));
vi.mock('../../../../stores/useAuth', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

import api from '../../../../lib/api';
import { BentoLoginPage } from '../BentoLoginPage';

const mockApi = api as unknown as { post: ReturnType<typeof vi.fn> };

describe('BentoLoginPage integration', () => {
  beforeEach(() => {
    mockApi.post.mockReset();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('shows "NIK / Email is required" when identifier is empty', async () => {
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Password'), 'something');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/nik \/ email is required/i)).toBeInTheDocument();
  });

  it('shows "Password is required" when password is empty', async () => {
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('does not call api.post when fields are empty', async () => {
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /continue/i }));
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
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email, password });
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
    await user.click(screen.getByRole('button', { name: /continue/i }));
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
    await user.click(screen.getByRole('button', { name: /continue/i }));
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
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });
    resolveLogin({ data: { user: { role: 'ADMIN' } } });
  });
});
