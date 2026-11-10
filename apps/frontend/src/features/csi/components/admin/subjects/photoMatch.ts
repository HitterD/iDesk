import { unzipSync } from 'fflate';

/** Extension → MIME type of the photos the subject photo endpoint accepts (JPG/PNG/WebP). */
const PHOTO_MIME: Readonly<Record<string, string>> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const MAC_RESOURCE_DIR = '__MACOSX/';

export interface PhotoMatch<F> {
    file: F;
    /** The single subject whose name equals the file name; null when none or several do. */
    key: string | null;
    /** Keys of every subject with that name when it is ambiguous (never auto-assigned). */
    candidates: string[];
}

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const extensionOf = (name: string) => {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};
const withoutExtension = (name: string) => {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
};

/**
 * File/subject name key, the FE twin of the backend `normalizeName` plus the separators people use in file
 * names: upper case, `.`, `_`, `,` and `-` become spaces, single spaces, trimmed.
 */
const normalizeSubjectName = (value: string) => value.toUpperCase().replace(/[._,-]/g, ' ').replace(/\s+/g, ' ').trim();
export const normalizePhotoName = (fileName: string): string => normalizeSubjectName(withoutExtension(baseName(fileName)));

/** Pairs each photo file with the subject of the same (normalised) name; ambiguous names are left to the user. */
export function matchPhotoFiles<F extends { name: string }>(files: readonly F[], subjects: ReadonlyArray<{ key: string; name: string }>): PhotoMatch<F>[] {
    const byName = new Map<string, string[]>();
    for (const subject of subjects) {
        const name = normalizeSubjectName(subject.name);
        if (name) byName.set(name, [...(byName.get(name) ?? []), subject.key]);
    }
    return files.map((file) => {
        const keys = byName.get(normalizePhotoName(file.name)) ?? [];
        return keys.length === 1 ? { file, key: keys[0], candidates: [] } : { file, key: null, candidates: keys };
    });
}

export const isPhotoName = (name: string) => extensionOf(name) in PHOTO_MIME;
export const isZipFile = (file: File) => extensionOf(file.name) === 'zip';

/** Photos inside a ZIP (any folder depth), skipping macOS resource forks, dotfiles and non-images. */
export async function expandZip(file: File): Promise<File[]> {
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
    return Object.entries(entries).flatMap(([path, data]) => {
        const name = baseName(path);
        if (path.startsWith(MAC_RESOURCE_DIR) || !name || name.startsWith('.') || !isPhotoName(name)) return [];
        return [new File([data], name, { type: PHOTO_MIME[extensionOf(name)] })];
    });
}
