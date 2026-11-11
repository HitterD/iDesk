import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { CsiHcApi } from '../csiHc.api';

vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

beforeEach(() => vi.resetAllMocks());

describe('CsiHcApi template files', () => {
    it('sends the file and JSON options as multipart fields', async () => {
        const file = new File(['workbook'], 'template.xlsx');
        const options = { commit: false, resolutions: { Person: { as: 'pic' as const } }, prune: true, pruneConfirmed: false };
        const report = { committed: false };
        vi.mocked(api.post).mockResolvedValue({ data: report });

        expect(await CsiHcApi.importTemplate('hc', 'SMG', file, options)).toBe(report);

        const [url, body] = vi.mocked(api.post).mock.calls[0];
        expect(url).toBe('/csi/admin/hc/templates/import/SMG');
        expect(body).toBeInstanceOf(FormData);
        expect((body as FormData).get('file')).toBe(file);
        expect(JSON.parse((body as FormData).get('options') as string)).toEqual(options);
        expect(vi.mocked(api.post).mock.calls[0]).toHaveLength(2);
    });

    it('requests the blank workbook as a blob', async () => {
        const blob = new Blob(['workbook']);
        vi.mocked(api.get).mockResolvedValue({ data: blob });

        expect(await CsiHcApi.downloadBlankTemplate('hc', 'JTB')).toBe(blob);
        expect(api.get).toHaveBeenCalledWith('/csi/admin/hc/templates/blank/JTB', expect.objectContaining({ responseType: 'blob' }));
    });
});
