import { matchByName, normalizeName } from './csi-name-match';

describe('normalizeName', () => {
    it('ignores case, extra spaces, dots and commas', () => {
        expect(normalizeName('  Eric  Gunawan Ph. ')).toBe('ERIC GUNAWAN PH');
        expect(normalizeName('FAJAR RACHMANTO, ST')).toBe('FAJAR RACHMANTO ST');
    });
});

describe('matchByName', () => {
    const people = [{ id: 'a', name: 'Rara Kurnia Maharani Pongdatu' }, { id: 'b', name: 'AGUS SUBEKTI' }, { id: 'c', name: 'agus subekti' }];
    it('finds one candidate regardless of spelling noise', () => {
        expect(matchByName('RARA KURNIA  MAHARANI PONGDATU', people, (row) => row.name)).toEqual({ id: 'a', name: 'Rara Kurnia Maharani Pongdatu' });
    });
    it('two people with the same name are ambiguous, none is null', () => {
        expect(matchByName('Agus Subekti', people, (row) => row.name)).toBe('ambiguous');
        expect(matchByName('Nobody', people, (row) => row.name)).toBeNull();
    });
});
