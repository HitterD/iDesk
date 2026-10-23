import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { UnifiedUserTable } from './UnifiedUserTable';
import type { User } from '@/types/admin.types';

vi.mock('@/components/ui/PresenceDot', () => ({ PresenceDot: () => null, PresenceBadge: () => null }));
vi.mock('./PresetDropdown', () => ({ PresetDropdown: () => <button>Permission preset</button> }));
it('keeps password reset accessible in mobile rows and delegates to existing handler', () => {
    const user = { id: 'u1', fullName: 'Agent Test', email: 'test@example.com', role: 'AGENT' } as User;
    const reset = vi.fn();
    render(<UnifiedUserTable users={[user]} searchQuery="" onEdit={vi.fn()} onDelete={vi.fn()} onResetPassword={reset}
        selectedIds={new Set()} onToggleSelection={vi.fn()} onSelectAll={vi.fn()} presets={[]} onApplyPreset={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Reset password for Agent Test' });
    expect(button.closest('.res-hide-m')).toBeNull();
    expect(screen.getByRole('button', { name: 'Permission preset' }).closest('.res-hide-m')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Agent Test' }).closest('.res-hide-m')).toBeNull();
    fireEvent.click(button);
    expect(reset).toHaveBeenCalledWith(user);
});
