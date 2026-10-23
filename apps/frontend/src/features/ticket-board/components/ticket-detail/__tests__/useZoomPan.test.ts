import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, useZoomPan } from '../useZoomPan';

const stage = () => ({ width: 1000, height: 800 });
const image = () => ({ width: 800, height: 600 });
const setup = () => renderHook(() => useZoomPan(stage, image));

describe('useZoomPan', () => {
    it('keeps the point under the cursor in place while zooming', () => {
        const { result } = setup();
        const point = { x: 200, y: -100 };

        act(() => result.current.zoomTo(2, point));

        const { scale, x, y } = result.current.view;
        // On screen an image point q sits at translate + scale * q; at scale 1 the cursor was over q = point.
        expect(scale).toBe(2);
        expect(x + scale * point.x).toBe(point.x);
        expect(y + scale * point.y).toBe(point.y);
    });

    it('keeps a zoomed image within reach when dragged far away', () => {
        const { result } = setup();
        act(() => result.current.zoomTo(3));
        act(() => result.current.panBy(10_000, 10_000));

        // 800 * 3 = 2400 wide on a 1000 stage: at most (2400 - 1000) / 2 + 48 off centre.
        expect(result.current.view.x).toBe(748);
        expect(result.current.view.y).toBe((600 * 3 - 800) / 2 + 48);
    });

    it('re-centres at or below fit size and caps the zoom', () => {
        const { result } = setup();
        act(() => result.current.zoomTo(0.6, { x: 300, y: 300 }));
        expect(result.current.view).toMatchObject({ x: 0, y: 0 });

        act(() => result.current.zoomTo(100));
        expect(result.current.view.scale).toBe(MAX_ZOOM);
    });

    it('double-click zooms to 2x, then back to fit; rapid wheel events build on each other', () => {
        const { result } = setup();
        act(() => result.current.toggleAt({ x: 0, y: 0 }));
        expect(result.current.view.scale).toBe(2);
        act(() => result.current.toggleAt({ x: 0, y: 0 }));
        expect(result.current.view.scale).toBe(1);

        act(() => {
            result.current.zoomByWheel(-100, { x: 0, y: 0 });
            result.current.zoomByWheel(-100, { x: 0, y: 0 });
        });
        expect(result.current.view.scale).toBeCloseTo(Math.exp(0.36), 5);
    });

    it('swaps width and height for the pan bounds once rotated sideways', () => {
        const { result } = setup();
        act(() => {
            result.current.rotate();
            result.current.zoomTo(2);
            result.current.panBy(10_000, 0);
        });
        // Rotated: 600 wide x 2 = 1200 on a 1000 stage.
        expect(result.current.view.x).toBe((1200 - 1000) / 2 + 48);
    });
});
