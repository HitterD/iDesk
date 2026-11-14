import { ratedAccountOf } from './csi-ratee-owner.util';

describe('ratedAccountOf', () => {
    it('a PIC ratee belongs to the account currently linked to the PIC, never falling back to a stale snapshot when the PIC still exists', () => {
        const linked = new Map<string, string | null>([['pic-1', 'u-now'], ['pic-unlinked', null]]);
        expect(ratedAccountOf({ picId: 'pic-1', userId: null }, linked)).toBe('u-now');
        expect(ratedAccountOf({ picId: 'pic-1', userId: 'u-old' }, linked)).toBe('u-now');
        expect(ratedAccountOf({ picId: 'pic-unlinked', userId: 'u-old' }, linked)).toBeNull();
        expect(ratedAccountOf({ picId: 'pic-2', userId: 'u-snap' }, linked)).toBe('u-snap');
        expect(ratedAccountOf({ picId: null, userId: 'u-person' }, linked)).toBe('u-person');
    });
});
