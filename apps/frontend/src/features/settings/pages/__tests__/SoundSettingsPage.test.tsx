import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SoundSettingsPage } from '../SoundSettingsPage';
import api from '@/lib/api';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe('SoundSettingsPage', () => {
    const mockSounds = [
        {
            id: 'sound-1',
            eventType: 'new_ticket', // Lowercase as returned by Postgres DB
            soundName: 'New Ticket Alert (Default)',
            soundUrl: '/sounds/default/new-ticket.mp3',
            isDefault: true,
            isActive: true,
        },
        {
            id: 'sound-2',
            eventType: 'new_ticket', // Lowercase as returned by Postgres DB
            soundName: 'My Custom Chime',
            soundUrl: '/uploads/sounds/custom1.mp3',
            isDefault: false,
            isActive: false,
        },
        {
            id: 'sound-3',
            eventType: 'message', // Lowercase as returned by Postgres DB
            soundName: 'New Message (Default)',
            soundUrl: '/sounds/default/message.mp3',
            isDefault: true,
            isActive: true,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (api.get as any).mockResolvedValue({ data: mockSounds });
    });

    it('renders sound preferences header and sounds table with database lowercase event types', async () => {
        render(<SoundSettingsPage />);

        expect(screen.getByText(/Sound Settings & Notifications/i)).toBeInTheDocument();
        expect(screen.getByText(/Preferensi Master Audio/i)).toBeInTheDocument();
        expect(screen.getByText(/Pustaka Nada Dering Notifikasi/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('New Ticket Alert (Default)')).toBeInTheDocument();
            expect(screen.getByText('My Custom Chime')).toBeInTheDocument();
            expect(screen.getByText('Custom Upload')).toBeInTheDocument();
        });
    });

    it('allows setting a sound as active', async () => {
        (api.post as any).mockResolvedValue({ data: { success: true } });

        render(<SoundSettingsPage />);

        await waitFor(() => {
            expect(screen.getByText('My Custom Chime')).toBeInTheDocument();
        });

        const setActiveBtn = screen.getByRole('button', { name: /Pilih Suara/i });
        fireEvent.click(setActiveBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/sounds/set-active/NEW_TICKET', {
                soundId: 'sound-2',
            });
        });
    });

    it('submits custom sound upload form', async () => {
        (api.post as any).mockResolvedValue({ data: { id: 'sound-new' } });

        render(<SoundSettingsPage />);

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const testFile = new File(['dummy audio content'], 'bell.mp3', { type: 'audio/mp3' });

        Object.defineProperty(fileInput, 'files', {
            value: [testFile],
        });

        fireEvent.change(fileInput);

        const uploadBtn = screen.getByRole('button', { name: /Upload & Simpan/i });
        fireEvent.click(uploadBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(
                '/sounds/upload',
                expect.any(FormData)
            );
        });
    });
});
