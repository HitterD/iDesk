import { pickPublicBaseUrl } from './app-url.util';

describe('pickPublicBaseUrl', () => {
    it('uses the https entry when FRONTEND_URL lists the LAN address first', () => {
        expect(pickPublicBaseUrl('http://192.168.2.136:3080,https://idesk.santos.co.id')).toBe('https://idesk.santos.co.id');
    });

    it('keeps a single entry and drops trailing slashes', () => {
        expect(pickPublicBaseUrl('http://localhost:5173/')).toBe('http://localhost:5173');
    });

    it('never returns several origins joined by a comma', () => {
        expect(pickPublicBaseUrl('http://a:1, http://b:2')).toBe('http://a:1');
    });

    it('falls back to the default when unset', () => {
        expect(pickPublicBaseUrl(undefined)).toBe('http://localhost:4050');
    });
});
