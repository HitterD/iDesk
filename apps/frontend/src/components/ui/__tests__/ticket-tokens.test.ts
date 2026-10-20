import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const css = readFileSync('src/index.css', 'utf8');

describe('scoped ticket design tokens', () => {
    it('defines exact sapphire, dark state, amber CTA and every soft pill tone', () => {
        expect(tokens).toContain('--idesk-sapphire: 221.684 51.351% 36.275%');
        expect(tokens).toContain('--idesk-chrome:');
        expect(tokens).toContain('--idesk-cta:');
        expect(tokens.match(/--idesk-surface:/g)).toHaveLength(2);
        for (const tone of ['neutral', 'blue', 'navy', 'amber', 'green', 'red', 'teal']) {
            expect(tokens).toContain(`--ticket-${tone}-ink:`);
            expect(css).toContain(`.ticket-tone-${tone}`);
        }
    });
    it('bounds portals by available viewport and uses scoped visible focus', () => {
        expect(css).toContain('--radix-popover-content-available-height');
        expect(css).toContain('--radix-popover-content-available-width');
        expect(css).toContain('.picker-trigger:focus-visible');
        expect(css).toContain('.picker-option[data-checked="true"]');
    });
});
