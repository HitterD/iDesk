import { ratedAccountOf } from './csi-ratee-owner.util';

describe('ratedAccountOf', () => {
    it('a PIC ratee belongs to the account currently linked to the PIC, falling back to the snapshot', () => {
        const linked = new Map([['pic-1', 'u-now']]);
        expect(ratedAccountOf({ picId: 'pic-1', userId: null }, linked)).toBe('u-now');
        expect(ratedAccountOf({ picId: 'pic-1', userId: 'u-old' }, linked)).toBe('u-now');
        expect(ratedAccountOf({ picId: 'pic-2', userId: 'u-snap' }, linked)).toBe('u-snap');
        expect(ratedAccountOf({ picId: null, userId: 'u-person' }, linked)).toBe('u-person');
    });
});
