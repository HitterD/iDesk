import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SiteSelector, SiteBadge } from '@/components/site/SiteSelector';

globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
const sites = [
    { id: 'spj', code: 'SPJ', name: 'Nama Sama', isActive: true },
    { id: 'smg', code: 'SMG', name: 'Nama Sama', isActive: true },
    { id: 'jtb', code: 'JTB', name: 'Jakarta', isActive: true },
];
function Example({ mode = 'multi', disabled = false }: { mode?: 'single' | 'multi'; disabled?: boolean }) {
    const [ids, setIds] = useState(['spj']);
    return <><output aria-label="Site IDs">{ids.join(',')}</output><SiteSelector selectedSiteIds={ids}
        onSelectionChange={setIds} mode={mode} disabled={disabled} /></>;
}
function mount(mode?: 'single' | 'multi', disabled?: boolean) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['sites', 'active'], sites);
    return render(<QueryClientProvider client={client}><Example mode={mode} disabled={disabled} /></QueryClientProvider>);
}

describe('SiteSelector', () => {
    it('preserves multiple IDs, toggles independently, selects all and resets without closing', async () => {
        const user = userEvent.setup();
        mount();
        const trigger = screen.getByRole('button', { name: 'Filter Site' });
        expect(trigger).toHaveClass('ticket-pill');
        await user.click(trigger);
        await user.click(screen.getByRole('option', { name: /SMG/ }));
        expect(screen.getByLabelText('Site IDs')).toHaveTextContent('spj,smg');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('option', { name: /SPJ/ })).toHaveAttribute('data-checked', 'true');
        expect(screen.getByRole('option', { name: /SMG/ })).toHaveAttribute('data-checked', 'true');
        expect(screen.getByRole('option', { name: /SPJ/ })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('option', { name: /SMG/ })).toHaveAttribute('aria-checked', 'true');
        await user.click(screen.getByRole('option', { name: /SPJ/ }));
        expect(screen.getByLabelText('Site IDs')).toHaveTextContent(/^smg$/);
        await user.click(screen.getByRole('button', { name: 'Select All' }));
        expect(screen.getByLabelText('Site IDs')).toHaveTextContent('spj,smg,jtb');
        await user.click(screen.getByRole('button', { name: 'Clear All' }));
        expect(screen.getByLabelText('Site IDs')).toBeEmptyDOMElement();
    });
    it('keeps single mode, keyboard search and Escape focus', async () => {
        const user = userEvent.setup();
        mount('single');
        const trigger = screen.getByRole('button', { name: 'Filter Site' });
        await user.click(trigger);
        await user.type(screen.getByRole('combobox', { name: 'Cari site…' }), 'SMG');
        await user.keyboard('{ArrowDown}{Enter}');
        expect(screen.getByLabelText('Site IDs')).toHaveTextContent(/^smg$/);
        await user.keyboard('{Escape}');
        expect(trigger).toHaveFocus();
    });
    it('does not open a disabled trigger and makes SiteBadge readonly soft teal, not purple', async () => {
        const user = userEvent.setup();
        mount('multi', true);
        await user.click(screen.getByRole('button', { name: 'Filter Site' }));
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        render(<SiteBadge code="JTB" />);
        expect(screen.getByText('JTB')).toHaveClass('ticket-pill', 'ticket-tone-teal');
        expect(screen.getByText('JTB')).not.toHaveAttribute('aria-haspopup');
    });
});
