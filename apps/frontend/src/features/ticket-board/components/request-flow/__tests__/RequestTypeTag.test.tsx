import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { REQUEST_KIND_META, requestKindFromParam, requestKindToParam } from '../requestKind';
import { RequestTypeTag } from '../RequestTypeTag';

afterEach(cleanup);

describe('REQUEST_KIND_META', () => {
    it('names both kinds and gives each its own tone', () => {
        expect(REQUEST_KIND_META.HARDWARE).toMatchObject({ label: 'Hardware', longLabel: 'Hardware Request', tone: 'hw' });
        expect(REQUEST_KIND_META.EFORM).toMatchObject({ label: 'E-Form', longLabel: 'E-Form Request', tone: 'ef' });
    });
});

describe('RequestTypeTag', () => {
    it('shows the short label with the kind tone', () => {
        render(<RequestTypeTag kind="HARDWARE" />);
        const tag = screen.getByText('Hardware').closest('[data-request-kind]');
        expect(tag).toHaveAttribute('data-request-kind', 'HARDWARE');
        expect(tag?.className).toContain('req-tag');
        expect(tag?.className).toContain('req-tag--hw');
    });

    it('the large size shows the long label', () => {
        render(<RequestTypeTag kind="EFORM" size="lg" />);
        expect(screen.getByText('E-Form Request')).toBeInTheDocument();
    });
});

describe('type filter URL param', () => {
    it('maps ?type= to the API requestKind and back', () => {
        expect(requestKindFromParam('hardware')).toBe('HARDWARE');
        expect(requestKindFromParam('eform')).toBe('EFORM');
        expect(requestKindFromParam('it')).toBe('IT');
        expect(requestKindFromParam('')).toBe('');
        expect(requestKindFromParam('junk')).toBe('');
        expect(requestKindToParam('EFORM')).toBe('eform');
        expect(requestKindToParam('')).toBe('');
    });
});
