import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IssueDialog } from '../IssueDialog';

afterEach(cleanup);

describe('IssueDialog', () => {
    it('needs a description of at least 5 characters', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<IssueDialog open onClose={vi.fn()} kind="HARDWARE" onSubmit={onSubmit} />);
        const send = screen.getByRole('button', { name: 'Kirim ke IT' });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Apa kendalanya/), { target: { value: 'abc' } });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Apa kendalanya/), { target: { value: 'Layar tidak menyala' } });
        fireEvent.click(send);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Layar tidak menyala'));
    });

    it('says what happens next in the words of the kind', () => {
        render(<IssueDialog open onClose={vi.fn()} kind="EFORM" onSubmit={vi.fn()} />);
        expect(screen.getByText(/IT akan memeriksa akses Anda lagi/)).toBeInTheDocument();
    });
});
