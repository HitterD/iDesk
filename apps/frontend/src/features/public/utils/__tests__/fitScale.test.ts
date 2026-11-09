import { describe, expect, it } from 'vitest';
import { DESIGN_HEIGHT, DESIGN_WIDTH, fitScale } from '../../components/useFitToScreen';

describe('fitScale', () => {
    it('keeps the 1920x1080 frame whole on smaller TV browsers', () => {
        for (const [w, h] of [[1280, 720], [1366, 768], [1536, 864], [1920, 1080], [3840, 2160]]) {
            const s = fitScale(w, h);
            expect(DESIGN_WIDTH * s).toBeLessThanOrEqual(w + 0.01);
            expect(DESIGN_HEIGHT * s).toBeLessThanOrEqual(h + 0.01);
        }
        expect(fitScale(1280, 720)).toBeCloseTo(2 / 3, 5);
    });

    it('letterboxes instead of cropping on non-16:9 screens', () => {
        expect(fitScale(1280, 1024)).toBeCloseTo(1280 / 1920, 5);
        expect(fitScale(2560, 1080)).toBeCloseTo(1, 5);
    });
});
