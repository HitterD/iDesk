import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TicketActionDialog } from '../TicketActionDialog';

function Workflow() {
    const [active, setActive] = useState<string | null>(null);
    return <>
        {['Selesaikan', 'Teruskan', 'Perpanjang SLA'].map((name) => <button key={name} onClick={() => setActive(name)}>{name}</button>)}
        <TicketActionDialog open={active !== null} onClose={() => setActive(null)} title={active || 'Aksi tiket'}>
            <button onClick={() => setActive(null)}>Batal</button>
        </TicketActionDialog>
    </>;
}

describe('Ticket action dialog lifecycle', () => {
    it('restores focus and pointer events across consecutive workflows', async () => {
        render(<Workflow />);
        for (const name of ['Selesaikan', 'Teruskan', 'Perpanjang SLA']) {
            const trigger = screen.getByRole('button', { name, exact: true });
            trigger.focus();
            fireEvent.click(trigger);
            expect(screen.getByRole('dialog', { name })).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
            expect(trigger).toHaveFocus();
            expect(document.body.style.pointerEvents).not.toBe('none');
        }
        for (let cycle = 0; cycle < 10; cycle += 1) {
            fireEvent.click(screen.getByRole('button', { name: 'Teruskan', exact: true }));
            fireEvent.keyDown(document, { key: 'Escape' });
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
            expect(document.body.style.pointerEvents).not.toBe('none');
        }
    });

    it('does not open the ticket row it was launched from when clicked inside', () => {
        // The row opens the ticket on click; React bubbles portal clicks to it unless the dialog stops them.
        const openRow = vi.fn();
        render(
            <div role="button" onClick={openRow}>
                <TicketActionDialog open onClose={() => undefined} title="Menunggu vendor">
                    <button type="button">Besok</button>
                </TicketActionDialog>
            </div>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Besok' }));
        fireEvent.click(screen.getByRole('dialog'));

        expect(openRow).not.toHaveBeenCalled();
    });
});
