import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TermsGate } from '../TermsGate';

afterEach(cleanup);

function scrollTo(box: HTMLElement, position: { top: number; height: number; client: number }) {
    Object.defineProperty(box, 'scrollHeight', { configurable: true, value: position.height });
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: position.client });
    Object.defineProperty(box, 'scrollTop', { configurable: true, value: position.top });
    fireEvent.scroll(box);
}

describe('TermsGate', () => {
    it('the agreement box is off until the terms were read to the bottom', () => {
        const onAccept = vi.fn();
        render(<TermsGate kindLabel="VPN" accepted={false} onAccept={onAccept} />);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeDisabled();
        expect(screen.getByText(/scroll sampai bawah/)).toBeInTheDocument();

        scrollTo(screen.getByTestId('terms-box'), { top: 20, height: 400, client: 100 });
        expect(checkbox).toBeDisabled();

        scrollTo(screen.getByTestId('terms-box'), { top: 298, height: 400, client: 100 });
        expect(checkbox).toBeEnabled();
        fireEvent.click(checkbox);
        expect(onAccept).toHaveBeenCalledWith(true);
    });

    it('a short text that needs no scrolling can be accepted straight away', () => {
        render(<TermsGate kindLabel="Email" accepted={false} onAccept={vi.fn()} />);
        const box = screen.getByTestId('terms-box');
        Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 90 });
        Object.defineProperty(box, 'clientHeight', { configurable: true, value: 100 });
        fireEvent.scroll(box);
        expect(screen.getByRole('checkbox')).toBeEnabled();
    });

    it('names the kind of access in the title', () => {
        render(<TermsGate kindLabel="Synology NAS" accepted onAccept={vi.fn()} />);
        expect(screen.getByText(/Synology NAS/)).toBeInTheDocument();
    });
});
