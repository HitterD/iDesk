import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RecipientInput } from '../RecipientInput';

afterEach(cleanup);

function Harness({ initial = [] as string[] }) {
    const [names, setNames] = useState<string[]>(initial);
    return <><RecipientInput value={names} onChange={setNames} /><output data-testid="out">{JSON.stringify(names)}</output></>;
}

const out = () => JSON.parse(screen.getByTestId('out').textContent!);

describe('RecipientInput', () => {
    it('Enter or comma adds the typed name as a chip', () => {
        render(<Harness />);
        const input = screen.getByLabelText('Nama penerima');
        fireEvent.change(input, { target: { value: 'Leony' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        fireEvent.change(input, { target: { value: 'Budi,' } });
        expect(out()).toEqual(['Leony', 'Budi']);
    });

    it('ignores empty and repeated names', () => {
        render(<Harness initial={['Leony']} />);
        const input = screen.getByLabelText('Nama penerima');
        fireEvent.change(input, { target: { value: 'leony' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(out()).toEqual(['Leony']);
    });

    it('a chip can be removed', () => {
        render(<Harness initial={['Leony', 'Budi']} />);
        fireEvent.click(screen.getByRole('button', { name: 'Hapus Leony' }));
        expect(out()).toEqual(['Budi']);
    });

    it('a name left in the field when focus leaves is kept, not lost', () => {
        render(<Harness />);
        const input = screen.getByLabelText('Nama penerima');
        fireEvent.change(input, { target: { value: 'Siti' } });
        fireEvent.blur(input);
        expect(out()).toEqual(['Siti']);
    });
});
