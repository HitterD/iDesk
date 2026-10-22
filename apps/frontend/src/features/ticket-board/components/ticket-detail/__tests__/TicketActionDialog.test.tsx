import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
    });
});
