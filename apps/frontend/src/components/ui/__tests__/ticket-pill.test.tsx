import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketPill, type TicketPillTone } from '../ticket-pill';

const tones: TicketPillTone[] = ['neutral', 'blue', 'navy', 'amber', 'green', 'red', 'teal'];

describe('TicketPill', () => {
    it.each(tones)('renders readonly %s soft pill without dropdown affordance', (tone) => {
        render(<TicketPill tone={tone} title="Site" className="custom" data-testid="pill">SPJ</TicketPill>);
        const pill = screen.getByTestId('pill');
        expect(pill.tagName).toBe('SPAN');
        expect(pill).toHaveClass('ticket-pill', `ticket-tone-${tone}`, 'custom');
        expect(pill).toHaveAttribute('title', 'Site');
        expect(pill).not.toHaveAttribute('tabindex');
        expect(pill.querySelector('svg')).toBeNull();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
