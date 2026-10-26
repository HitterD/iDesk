import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForgotPasswordDialog, maskEmail } from '../ForgotPasswordDialog';
import api from '@/lib/api';

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }));

describe('ForgotPasswordDialog', () => {
    beforeEach(() => vi.clearAllMocks());

    const submitButton = () => screen.getByRole('button', { name: /kirim password sementara/i });
    const fill = (nik: string, email: string) => {
        fireEvent.change(screen.getByLabelText(/nik hris/i), { target: { value: nik } });
        fireEvent.change(screen.getByLabelText(/email terdaftar/i), { target: { value: email } });
    };

    it('mengirim NIK beserta email terdaftar dan menampilkan email tujuan tersamar', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: { sentTo: 'budi@kapalapi.co.id' } });
        render(<ForgotPasswordDialog onClose={vi.fn()} />);

        fill(' 12345 ', 'budi@kapalapi.co.id');
        fireEvent.click(submitButton());

        expect(await screen.findByText('bu***@kapalapi.co.id')).toBeInTheDocument();
        expect(api.post).toHaveBeenCalledWith(
            '/auth/forgot-password',
            { identifier: '12345', email: 'budi@kapalapi.co.id' },
            { skipToast: true },
        );
    });

    it('selalu meminta NIK dan email, juga saat NIK diisi email', () => {
        render(<ForgotPasswordDialog onClose={vi.fn()} />);
        fireEvent.change(screen.getByLabelText(/nik hris/i), { target: { value: 'budi@kapalapi.co.id' } });

        expect(screen.getByLabelText(/email terdaftar/i)).toBeInTheDocument();
        expect(submitButton()).toBeDisabled();
    });

    it('menjelaskan bahwa NIK dan email dicocokkan dengan data terdaftar', () => {
        render(<ForgotPasswordDialog onClose={vi.fn()} />);
        expect(screen.getByText(/dengan data hris anda/i)).toBeInTheDocument();
    });

    it('menampilkan pesan error dari server', async () => {
        vi.mocked(api.post).mockRejectedValue({ response: { data: { message: 'NIK dan email tidak cocok dengan data terdaftar.' } } });
        render(<ForgotPasswordDialog onClose={vi.fn()} />);

        fill('99999', 'x@gmail.com');
        fireEvent.click(submitButton());

        expect(await screen.findByRole('alert')).toHaveTextContent(/tidak cocok/i);
    });

    it('menutup dialog dengan Escape', () => {
        const onClose = vi.fn();
        render(<ForgotPasswordDialog onClose={onClose} />);
        fireEvent.keyDown(screen.getByLabelText(/nik hris/i), { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});

describe('maskEmail', () => {
    it('menyamarkan bagian lokal email', () => {
        expect(maskEmail('budi.santoso@kapalapi.co.id')).toBe('bu***@kapalapi.co.id');
    });
});
