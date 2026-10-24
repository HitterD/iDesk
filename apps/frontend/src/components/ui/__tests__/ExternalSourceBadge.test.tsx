import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExternalSourceBadge, externalSourceOf } from '../ExternalSourceBadge';

describe('ExternalSourceBadge', () => {
    it('labels tickets filed through iPop', () => {
        render(<ExternalSourceBadge source="IPOP" />);
        expect(screen.getByText('via iPop')).toHaveClass('ticket-pill', 'ticket-tone-blue');
        expect(screen.getByText('via iPop').className).not.toMatch(/violet|purple/);
    });

    it('renders nothing for tickets created in iDesk', () => {
        const { container } = render(<ExternalSourceBadge source="WEB" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('names the connected app that filed the ticket', () => {
        render(<ExternalSourceBadge source="API" externalSource="EBBK" />);
        expect(screen.getByText('via EBBK')).toHaveAttribute('title', 'Tiket dibuat dari aplikasi EBBK lewat API');
        expect(externalSourceOf('API', null)).toBeUndefined();
    });
});
