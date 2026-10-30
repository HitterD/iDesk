import * as fs from 'fs';
import * as path from 'path';

const SANTOS_LOGO_FILE = 'santos-logo.png';

/**
 * Where santos-logo.png can live. nest-cli copies `assets/**` into `dist/assets`
 * keeping the `assets/` prefix, so a production build ends up with
 * `dist/assets/assets/santos-logo.png` while compiled code sits in `dist/src/...`.
 */
export const santosLogoCandidates = (baseDir: string = __dirname, cwd: string = process.cwd()): string[] => [
    path.join(baseDir, '../../../assets', SANTOS_LOGO_FILE), // src/shared/core/utils -> src/assets (ts-node / jest)
    path.join(baseDir, '../../../../assets/assets', SANTOS_LOGO_FILE), // dist/src/shared/core/utils -> dist/assets/assets
    path.join(baseDir, '../../../../assets', SANTOS_LOGO_FILE),
    path.join(cwd, 'dist/assets/assets', SANTOS_LOGO_FILE),
    path.join(cwd, 'dist/assets', SANTOS_LOGO_FILE),
    path.join(cwd, 'src/assets', SANTOS_LOGO_FILE),
    path.join(cwd, 'apps/backend/src/assets', SANTOS_LOGO_FILE),
];

let cachedLogoPath: string | null | undefined;

/** Absolute path of the PT Santos Jaya Abadi logo, or null when it isn't shipped. */
export function resolveSantosLogoPath(): string | null {
    if (cachedLogoPath === undefined) {
        cachedLogoPath = santosLogoCandidates().find((p) => fs.existsSync(p)) ?? null;
    }
    return cachedLogoPath;
}
