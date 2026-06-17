import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ZoomShortcutsModal } from '../ZoomShortcutsModal';

describe('ZoomShortcutsModal', () => {
    it('renders keyboard shortcut list when open', () => {
        render(<ZoomShortcutsModal open={true} onClose={() => {}} />);
        // Check several known shortcuts appear
        expect(screen.getAllByText(/focus search/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/jump to today/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/month view/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/open book meeting/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/toggle gabungan/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/open this shortcuts/i).length).toBeGreaterThan(0);
    });

    it('renders shortcut keys', () => {
        render(<ZoomShortcutsModal open={true} onClose={() => {}} />);
        // Some specific keys
        expect(screen.getAllByText('?').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Esc').length).toBeGreaterThan(0);
        expect(screen.getAllByText('G').length).toBeGreaterThan(0);
    });
});
