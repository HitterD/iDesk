const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        create: jest.fn(() => ({ get: mockGet, post: mockPost })),
    },
}));

import { HrisGatewayAdapter, isHrisLoginVerifyEnabled, resolveRequestTimeoutMs } from './hris-gateway.adapter';

describe('resolveRequestTimeoutMs', () => {
    it.each([
        [undefined, 10_000],
        ['', 10_000],
        ['abc', 10_000],
        ['0', 10_000],
        ['-5', 10_000],
        ['5000', 5_000],
        ['999999', 30_000],
    ])('maps %s to %s ms', (raw, expected) => {
        expect(resolveRequestTimeoutMs(raw)).toBe(expected);
    });
});

describe('isHrisLoginVerifyEnabled', () => {
    it.each([
        [undefined, true],
        ['', true],
        ['true', true],
        ['anything-else', true],
    ])('stays enabled for %s (opt-out only)', (raw, expected) => {
        expect(isHrisLoginVerifyEnabled(raw)).toBe(expected);
    });

    it.each(['false', 'FALSE', ' false '])('disables on explicit %s', raw => {
        expect(isHrisLoginVerifyEnabled(raw)).toBe(false);
    });
});

describe('HrisGatewayAdapter', () => {
    let adapter: HrisGatewayAdapter;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.HRIS_GATEWAY_BASE_URL = 'http://10.10.6.51:27080/api/v1';
        process.env.HRIS_GATEWAY_API_KEY = 'test-key';
        adapter = new HrisGatewayAdapter();
    });

    it('reports configured only when both env values exist', () => {
        expect(adapter.isConfigured()).toBe(true);
        delete process.env.HRIS_GATEWAY_API_KEY;
        expect(adapter.isConfigured()).toBe(false);
    });

    it('returns Gateway password verification result', async () => {
        mockPost.mockResolvedValue({ data: { valid: true, eligible: true, match: false } });

        await expect(adapter.verifyPassword('00000024', 'secret')).resolves.toEqual({
            valid: true,
            eligible: true,
            match: false,
        });
        expect(mockPost).toHaveBeenCalledWith('/auth/verify', { nik: '00000024', password: 'secret' });
    });

    it('throws unavailable error when password verification cannot reach Gateway', async () => {
        mockPost.mockRejectedValue(new Error('ECONNREFUSED'));
        await expect(adapter.verifyPassword('00000024', 'secret')).rejects.toMatchObject({
            name: 'HrisUnavailableError',
        });
    });

    it('rejects malformed password verification response', async () => {
        mockPost.mockResolvedValue({ data: { valid: true } });
        await expect(adapter.verifyPassword('00000024', 'secret')).rejects.toMatchObject({
            name: 'HrisInvalidResponseError',
        });
    });

    it('retries GET employee then returns it', async () => {
        mockGet
            .mockRejectedValueOnce(new Error('socket hang up'))
            .mockResolvedValueOnce({ data: { nik_hris: '00000024', nama_karyawan: 'TEST' } });

        await expect(adapter.getEmployee('00000024')).resolves.toMatchObject({ nik_hris: '00000024' });
        expect(mockGet).toHaveBeenCalledTimes(2);
        expect(mockGet).toHaveBeenLastCalledWith('/employees/00000024');
    });

    it('returns null after GET retries are exhausted', async () => {
        mockGet.mockRejectedValue(new Error('timeout'));

        await expect(adapter.getEmployee('00000024')).resolves.toBeNull();
        expect(mockGet).toHaveBeenCalledTimes(3);
    });

    it('fetches employees with supported page query parameter', async () => {
        mockGet.mockResolvedValue({ data: { data: [], total: 4736 } });

        await expect(adapter.getEmployeesPage(2)).resolves.toEqual({ data: [], total: 4736 });
        expect(mockGet).toHaveBeenCalledWith('/employees?page=2');
    });
});
