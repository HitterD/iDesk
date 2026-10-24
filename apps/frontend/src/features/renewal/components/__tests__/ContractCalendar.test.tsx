import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContractCalendar } from '../ContractCalendar';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

describe('ContractCalendar', () => {
    it('keeps the month being viewed when contracts reload (skeleton no longer skips the hooks)', () => {
        const { rerender } = render(<ContractCalendar contracts={[]} />);
        fireEvent.click(screen.getByRole('button', { name: '→' }));
        const next = new Date(new Date().getFullYear(), new Date().getMonth() + 1);
        const label = `${MONTHS[next.getMonth()]} ${next.getFullYear()}`;
        expect(screen.getByText(label)).toBeInTheDocument();

        rerender(<ContractCalendar contracts={[]} isLoading />);
        rerender(<ContractCalendar contracts={[]} />);
        expect(screen.getByText(label)).toBeInTheDocument();
    });
});
