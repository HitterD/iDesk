import { buildWsCorsOrigin, isAllowedWsOrigin } from './ws-origin';

describe('WebSocket origin policy', () => {
    const previousOrigin = process.env.WS_CORS_ORIGIN;

    beforeEach(() => {
        process.env.WS_CORS_ORIGIN = 'https://app.example.com';
    });

    afterAll(() => {
        process.env.WS_CORS_ORIGIN = previousOrigin;
    });

    it.each([
        'https://app.example.com',
        'https://idesk.santos.co.id',
        'http://192.168.2.136:3080',
        'http://10.1.2.3',
        'http://172.20.0.5:8080',
        'http://localhost:4050',
        undefined,
    ])('accepts %s', (origin) => {
        expect(isAllowedWsOrigin(origin)).toBe(true);
    });

    it.each([
        'https://evil.example.com',
        'http://192.168.2.136.evil.com',
        'http://172.32.0.1',
        'https://santos.co.id.evil.com',
    ])('rejects %s', (origin) => {
        expect(isAllowedWsOrigin(origin)).toBe(false);
    });

    it('reports a rejection through the socket.io callback', () => {
        const callback = jest.fn();
        buildWsCorsOrigin('nope')('https://evil.example.com', callback);
        expect(callback).toHaveBeenCalledWith(expect.objectContaining({ message: 'nope' }), false);
    });
});
