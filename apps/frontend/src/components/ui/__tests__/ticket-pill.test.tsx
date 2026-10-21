import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketPill, STATUS_TONES, type TicketPillTone } from '../ticket-pill';

const tones: TicketPillTone[] = ['neutral', 'blue', 'sky', 'navy', 'amber', 'green', 'red', 'teal'];

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

    it('keeps Open (sky) and In Progress (navy) on distinct tones', () => {
        expect(STATUS_TONES.TODO).toBe('sky');
        expect(STATUS_TONES.IN_PROGRESS).toBe('navy');
    });
});
