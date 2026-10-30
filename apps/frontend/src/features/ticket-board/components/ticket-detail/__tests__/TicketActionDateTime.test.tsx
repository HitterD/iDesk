import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TicketActionDialog } from '../TicketActionDialog';
import { ModernDateTimePicker } from '@/components/ui/ModernDateTimePicker';

function Workflow() {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(new Date(2030, 4, 15, 9, 7));
    return <><button onClick={() => setOpen(true)}>Jadwalkan</button>
        <TicketActionDialog open={open} onClose={() => setOpen(false)} title="Jadwal">
            <ModernDateTimePicker value={value} onChange={setValue} />
            <output aria-label="Nilai jadwal">{value.getDate()} {value.getHours()}:{value.getMinutes()}</output>
        </TicketActionDialog>
    </>;
}

describe('Ticket date/time interaction', () => {
    it('selects date and every minute, closes only the picker on Escape, then closes parent', async () => {
        render(<Workflow />);
        fireEvent.click(screen.getByRole('button', { name: 'Jadwalkan' }));
        fireEvent.click(screen.getByRole('button', { name: /15 Mei 2030/ }));
        fireEvent.click(await screen.findByRole('button', { name: '16 Mei 2030' }));
        fireEvent.change(screen.getByLabelText('Jam'), { target: { value: '14' } });
        fireEvent.change(screen.getByLabelText('Menit'), { target: { value: '7' } });
        expect(screen.getByLabelText('Nilai jadwal')).toHaveTextContent('16 14:7');
        fireEvent.keyDown(screen.getByLabelText('Menit'), { key: 'Escape' });
        await waitFor(() => expect(screen.queryByLabelText('Menit')).not.toBeInTheDocument());
        expect(screen.getByRole('dialog', { name: 'Jadwal' })).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('button', { name: /16 Mei 2030/ }), { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(document.body.style.pointerEvents).not.toBe('none');
        fireEvent.click(screen.getByRole('button', { name: 'Jadwalkan' }));
        expect(screen.getByRole('dialog', { name: 'Jadwal' })).toBeInTheDocument();
    });
});
