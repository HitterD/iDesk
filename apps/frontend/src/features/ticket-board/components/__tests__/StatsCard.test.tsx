import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Hourglass } from 'lucide-react';
import { StatsCard } from '../StatsCard';

describe('StatsCard queue contract', () => {
    it('uses a soft semantic attention tint and exposes selected state with keyboard activation', () => {
        const onClick = vi.fn();
        render(<StatsCard icon={Hourglass} label="Waiting Vendor" value="9" color="text-amber-600"
            bgColor="bg-amber-500/10" tone="amber" highlight isActive onClick={onClick} />);
        const card = screen.getByRole('button', { name: /Waiting Vendor/ });
        expect(card).toHaveClass('queue-stat', 'ticket-tone-amber', 'is-attention');
        expect(card).toHaveAttribute('aria-pressed', 'true');
        fireEvent.keyDown(card, { key: ' ' });
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('keeps legacy props working without adding a fake button for readonly stats', () => {
        render(<StatsCard icon={Hourglass} label="Total" value="0" color="text-primary" bgColor="bg-primary/10" />);
        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.queryByRole('button')).toBeNull();
    });
});
