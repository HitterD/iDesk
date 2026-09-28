import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dialog, DialogContent, DialogTitle } from '../dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';

const zIndexOf = (el: Element | null) => {
    const match = el?.className.toString().match(/z-\[(\d+)\]|z-(\d+)/);
    return match ? Number(match[1] ?? match[2]) : 0;
};

describe('overlay layering', () => {
    it('renders a Select menu above the dialog it is opened from', async () => {
        // jsdom lacks these; Radix Select calls them when it opens.
        Element.prototype.scrollIntoView ??= () => {};
        Element.prototype.hasPointerCapture ??= () => false;

        render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Book Meeting</DialogTitle>
                    <Select open>
                        <SelectTrigger aria-label="Zoom Account">
                            <SelectValue placeholder="Pilih akun Zoom" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="a">Zoom Admin 1</SelectItem>
                        </SelectContent>
                    </Select>
                </DialogContent>
            </Dialog>,
        );

        const listbox = await screen.findByRole('listbox');
        // The open Select marks the rest of the page aria-hidden.
        const dialog = screen.getByRole('dialog', { hidden: true });

        expect(zIndexOf(listbox)).toBeGreaterThan(zIndexOf(dialog));
    });
});
