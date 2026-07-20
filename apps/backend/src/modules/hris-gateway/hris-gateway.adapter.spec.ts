const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        create: jest.fn(() => ({ get: mockGet, post: mockPost })),
    },
}));

import { HrisGatewayAdapter } from './hris-gateway.adapter';

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

    it('returns null when password verification cannot reach Gateway', async () => {
        mockPost.mockRejectedValue(new Error('ECONNREFUSED'));
        await expect(adapter.verifyPassword('00000024', 'secret')).resolves.toBeNull();
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
