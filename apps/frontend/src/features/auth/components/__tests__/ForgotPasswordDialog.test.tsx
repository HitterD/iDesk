import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForgotPasswordDialog } from '../ForgotPasswordDialog';
import api from '@/lib/api';

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }));

describe('ForgotPasswordDialog', () => {
    beforeEach(() => vi.clearAllMocks());

    const submit = () => fireEvent.click(screen.getByRole('button', { name: /kirim password baru/i }));

    it('mengirim NIK beserta email tujuan', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: { sentTo: 'budi@gmail.com' } });
        render(<ForgotPasswordDialog onClose={vi.fn()} />);

        fireEvent.change(screen.getByLabelText(/nik hris/i), { target: { value: '12345' } });
        fireEvent.change(screen.getByLabelText(/kirim ke email/i), { target: { value: 'budi@gmail.com' } });
        submit();

        expect(await screen.findByText('budi@gmail.com')).toBeInTheDocument();
        expect(api.post).toHaveBeenCalledWith(
            '/auth/forgot-password',
            { identifier: '12345', email: 'budi@gmail.com' },
            { skipToast: true },
        );
    });

    it('menyembunyikan field email tujuan saat identifier berupa email terdaftar', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: { sentTo: 'budi@kapalapi.co.id' } });
        render(<ForgotPasswordDialog onClose={vi.fn()} />);

        fireEvent.change(screen.getByLabelText(/nik hris/i), { target: { value: 'budi@kapalapi.co.id' } });
        expect(screen.queryByLabelText(/kirim ke email/i)).not.toBeInTheDocument();
        submit();

        expect(await screen.findByText('budi@kapalapi.co.id')).toBeInTheDocument();
        expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', { identifier: 'budi@kapalapi.co.id' }, { skipToast: true });
    });

    it('menonaktifkan tombol kirim saat NIK tanpa email tujuan', () => {
        render(<ForgotPasswordDialog onClose={vi.fn()} />);
        fireEvent.change(screen.getByLabelText(/nik hris/i), { target: { value: '12345' } });
        expect(screen.getByRole('button', { name: /kirim password baru/i })).toBeDisabled();
    });

    it('menampilkan pesan error dari server', async () => {
        vi.mocked(api.post).mockRejectedValue({ response: { data: { message: 'NIK tidak ditemukan. Periksa kembali NIK HRIS Anda.' } } });
        render(<ForgotPasswordDialog onClose={vi.fn()} />);

        fireEvent.change(screen.getByLabelText(/nik hris/i), { target: { value: '99999' } });
        fireEvent.change(screen.getByLabelText(/kirim ke email/i), { target: { value: 'x@gmail.com' } });
        submit();

        expect(await screen.findByRole('alert')).toHaveTextContent(/nik tidak ditemukan/i);
    });
});
