import { safeReturnTo } from './auth.controller';

describe('safeReturnTo', () => {
    it.each([
        ['/tickets/4821', '/tickets/4821'],
        ['/tickets?tab=chat#m1', '/tickets?tab=chat#m1'],
        ['//evil.example', '/'],
        ['/\\evil.example', '/'],
        ['https://evil.example/x', '/'],
        ['javascript:alert(1)', '/'],
        ['tickets', '/'],
        [undefined, '/'],
        [['/a', '/b'], '/'],
    ])('%p -> %p', (input, expected) => {
        expect(safeReturnTo(input)).toBe(expected);
    });
});
