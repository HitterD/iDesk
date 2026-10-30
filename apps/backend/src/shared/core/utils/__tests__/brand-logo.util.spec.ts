import * as path from 'path';
import { resolveSantosLogoPath, santosLogoCandidates } from '../brand-logo.util';

describe('brand logo resolution', () => {
    it('finds the logo shipped in src/assets', () => {
        expect(resolveSantosLogoPath()).toBe(path.join(__dirname, '../../../../assets/santos-logo.png'));
    });

    it('covers where nest-cli copies the logo in a production build', () => {
        const candidates = santosLogoCandidates(path.join('/app', 'dist/src/shared/core/utils'), '/app');
        expect(candidates).toContain(path.join('/app', 'dist/assets/assets/santos-logo.png'));
    });
});
