import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TicketTypeCard } from '../TicketTypeCard';

const renderCard = () => {
    const onSelect = vi.fn();
    const utils = render(
        <TicketTypeCard title="Service Ticket" description="Laporkan gangguan" mascotImg="/m.png"
            mascotAlt="Maskot" ctaLabel="Buat tiket" onSelect={onSelect} />,
    );
    return { onSelect, ...utils };
};

// jsdom cannot reproduce the press-scale geometry that made the browser fire `click` on the
// article instead of the stretched button, so the card itself must own the handler.
describe('TicketTypeCard hit target', () => {
    it.each([
        ['title', () => screen.getByRole('heading', { name: 'Service Ticket' })],
        ['mascot', () => screen.getByAltText('Maskot')],
        ['description', () => screen.getByText('Laporkan gangguan')],
        ['card surface', () => screen.getByRole('article')],
    ])('selects the type when the %s is clicked', (_part, target) => {
        const { onSelect } = renderCard();
        fireEvent.click(target());
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('selects exactly once from the keyboard-reachable action link', () => {
        const { onSelect } = renderCard();
        fireEvent.click(screen.getByRole('button', { name: 'Pilih Service Ticket' }));
        expect(onSelect).toHaveBeenCalledTimes(1);
    });
});
