import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ user: { id: 'u1', role: 'USER', fullName: 'Test User' }, setTheme: vi.fn() }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ theme: 'light', setTheme: state.setTheme }) }));
vi.mock('../../components/ProfileSettingsForm', () => ({ ProfileSettingsForm: () => <div>Profile form</div> }));
vi.mock('../../components/SecuritySettingsForm', () => ({ SecuritySettingsForm: () => <div>Security form</div> }));
vi.mock('../../components/NotificationSettings', () => ({ NotificationSettings: () => <div>Notification form</div> }));
vi.mock('@/components/ui/CannedResponses', () => ({ CannedResponsesManager: () => <div>Quick replies form</div> }));
import { BentoSettingsPage } from '../BentoSettingsPage';

function renderPage(path = '/settings/profile') {
    return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/settings/:tab" element={<BentoSettingsPage />} /></Routes></MemoryRouter>);
}

describe('Settings navigation', () => {
    it('uses the approved header and keeps admin tabs hidden from ordinary users', () => {
        state.user.role = 'USER';
        renderPage();
        expect(screen.getByText('Kelola preferensi akun dan konfigurasi sistem')).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: 'SLA Settings' })).not.toBeInTheDocument();
        expect(screen.getByText('Profile form')).toBeInTheDocument();
    });
    it('preserves navigation and theme changes', async () => {
        renderPage('/settings/appearance');
        await userEvent.click(screen.getByRole('button', { name: /Dark Mode/ }));
        expect(state.setTheme).toHaveBeenCalledWith('dark');
        await userEvent.click(screen.getByRole('tab', { name: 'Security' }));
        expect(screen.getByText('Security form')).toBeInTheDocument();
    });
});
