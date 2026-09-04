import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MustChangePasswordDialog } from '../MustChangePasswordDialog';
import api from '@/lib/api';

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }));

describe('MustChangePasswordDialog', () => {
    beforeEach(() => vi.clearAllMocks());

    const setup = (props = {}) =>
        render(<MustChangePasswordDialog currentPassword="123456" onSuccess={vi.fn()} {...props} />);

    it('menolak password 123456 (terlalu pendek → ditangkap policy)', async () => {
        setup();
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: '123456' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        // 123456 gagal di minimal 8 karakter sebelum cek khusus 123456
        expect((await screen.findAllByText(/minimal 8/i)).length).toBeGreaterThan(0);
        expect(api.post).not.toHaveBeenCalled();
    });

    it('menolak konfirmasi tidak cocok', async () => {
        setup();
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: 'Str0ngPass99!!' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: 'Str0ngPass99!x' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        expect(await screen.findByText(/tidak cocok/i)).toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
    });

    it('menolak kurang dari 8 karakter', async () => {
        setup();
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: 'Ab1Xy2!' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: 'Ab1Xy2!' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        expect((await screen.findAllByText(/minimal 8/i)).length).toBeGreaterThan(0);
        expect(api.post).not.toHaveBeenCalled();
    });

    it('menolak tanpa huruf besar/kecil/angka', async () => {
        setup();
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: 'alllowercase12' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: 'alllowercase12' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        expect((await screen.findAllByText(/huruf besar/i)).length).toBeGreaterThan(0);
        expect(api.post).not.toHaveBeenCalled();
    });

    it('submit valid memanggil api dengan currentPassword auto-fill lalu onSuccess', async () => {
        (api.post as any).mockResolvedValue({ data: {} });
        const onSuccess = vi.fn();
        setup({ onSuccess });
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: 'Str0ngPass99!!' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: 'Str0ngPass99!!' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        await waitFor(() =>
            expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
                currentPassword: '123456',
                newPassword: 'Str0ngPass99!!',
            }),
        );
        await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    });
});
