import { it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RejectDialog } from '../components/detail/RejectDialog';

it('disables confirm when reason <5 char', () => {
    render(<RejectDialog open onClose={() => {}} onConfirm={() => {}} />);
    const btn = screen.getByRole('button', { name: /tolak/i });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tidak sesuai' } });
    expect(btn).not.toBeDisabled();
});
