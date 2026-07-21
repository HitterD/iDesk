import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MustChangePasswordDialog } from '../MustChangePasswordDialog';
import api from '@/lib/api';

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }));

describe('MustChangePasswordDialog', () => {
    beforeEach(() => vi.clearAllMocks());

    const setup = (props = {}) =>
        render(<MustChangePasswordDialog currentPassword="123456" onSuccess={vi.fn()} {...props} />);

    it('menolak password 123456', async () => {
        setup();
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: '123456' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        expect(await screen.findByText(/tidak boleh 123456/i)).toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
    });

    it('menolak konfirmasi tidak cocok', async () => {
        setup();
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: 'newpass88' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: 'different8' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        expect(await screen.findByText(/tidak cocok/i)).toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
    });

    it('menolak kurang dari 8 karakter', async () => {
        setup();
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: 'short7x' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: 'short7x' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        expect(await screen.findByText(/minimal 8/i)).toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
    });

    it('submit valid memanggil api dengan currentPassword auto-fill lalu onSuccess', async () => {
        (api.post as any).mockResolvedValue({ data: {} });
        const onSuccess = vi.fn();
        setup({ onSuccess });
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: 'newpass88' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: 'newpass88' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        await waitFor(() =>
            expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
                currentPassword: '123456',
                newPassword: 'newpass88',
            }),
        );
        await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    });
});
