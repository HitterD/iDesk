import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SimpleRecurringField } from '../SimpleRecurringField';

function setup(isRecurring = false) {
    const props = {
        isRecurring,
        setIsRecurring: vi.fn(),
        freq: 'WEEKLY',
        setFreq: vi.fn(),
        interval: 1,
        setInterval: vi.fn(),
        until: '',
        setUntil: vi.fn(),
    };

    render(<SimpleRecurringField {...props} />);

    return props;
}

describe('SimpleRecurringField', () => {
    it('hides recurrence controls when disabled', () => {
        setup(false);

        expect(screen.queryByLabelText('Interval')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Frekuensi')).not.toBeInTheDocument();
    });

    it('shows compact recurrence controls when enabled', () => {
        setup(true);

        expect(screen.getByText('Setiap')).toBeInTheDocument();
        expect(screen.getByLabelText('Interval')).toBeInTheDocument();
        expect(screen.getByLabelText('Frekuensi')).toBeInTheDocument();
    });

    it('updates recurring state through its switch', () => {
        const props = setup(false);

        fireEvent.click(screen.getByRole('switch'));

        expect(props.setIsRecurring).toHaveBeenCalledWith(true);
    });
});
