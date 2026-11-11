import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../lib/periodForm';
import { SECTION_COPY } from '../../wizard/wizardCopy';
import { SectionFields } from '../SectionFields';

afterEach(cleanup);

describe('SectionFields', () => {
    it('score band preview is a labelled group (aria-label on a role, not on a bare <p>)', () => {
        render(<SectionFields form={initialState('hc')} set={vi.fn()} locked={false} />);
        const preview = screen.getByRole('group', { name: SECTION_COPY.bandsPreview });
        expect(preview.tagName).not.toBe('P');
        expect(within(preview).getAllByText(/./).length).toBeGreaterThanOrEqual(3);
    });
});
