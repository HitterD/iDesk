import { useCallback, useMemo, useRef, useState } from 'react';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;
const BUTTON_FACTOR = 1.25;
/** Wheel sensitivity: one notch (~100 px of deltaY) zooms about 18%. */
const WHEEL_FACTOR = 0.0018;
/** How far past the edge a zoomed image may be dragged, so its border stays reachable. */
const PAN_SLACK = 48;

export interface View { scale: number; x: number; y: number; rotation: number }
export const FIT_VIEW: View = { scale: 1, x: 0, y: 0, rotation: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface Size { width: number; height: number }

/**
 * Zoom and pan for an image shown "fit to screen" at scale 1. Zoom keeps the point under the cursor (or the
 * pinch centre) in place, panning is bounded so the image cannot be lost off-screen, and `animate` tells the
 * caller whether to ease the change (buttons, double-click) or follow the input directly (wheel, drag, pinch).
 *
 * Points are relative to the stage centre; `imageSize` is the fitted, unscaled image size.
 */
export function useZoomPan(stageSize: () => Size, imageSize: () => Size) {
    const [view, setView] = useState<View>(FIT_VIEW);
    const [animate, setAnimate] = useState(true);
    const viewRef = useRef(view);
    viewRef.current = view;

    const bounded = useCallback((next: View): View => {
        const stage = stageSize();
        const image = imageSize();
        const sideways = next.rotation % 180 !== 0;
        const w = (sideways ? image.height : image.width) * next.scale;
        const h = (sideways ? image.width : image.height) * next.scale;
        const maxX = Math.max(0, (w - stage.width) / 2 + PAN_SLACK);
        const maxY = Math.max(0, (h - stage.height) / 2 + PAN_SLACK);
        // At or below fit size the image simply stays centred.
        return next.scale <= 1
            ? { ...next, x: 0, y: 0 }
            : { ...next, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
    }, [stageSize, imageSize]);

    const apply = useCallback((next: View, eased: boolean) => {
        const result = bounded(next);
        // Several wheel/pinch events can arrive before React re-renders; each must build on the last.
        viewRef.current = result;
        setAnimate(eased);
        setView(result);
    }, [bounded]);

    /** Zooms to `scale`, keeping `point` (default: centre) where it is on screen. */
    const zoomTo = useCallback((scale: number, point = { x: 0, y: 0 }, eased = true) => {
        const current = viewRef.current;
        const next = clamp(scale, MIN_ZOOM, MAX_ZOOM);
        const ratio = next / current.scale;
        apply({
            ...current,
            scale: next,
            x: point.x - (point.x - current.x) * ratio,
            y: point.y - (point.y - current.y) * ratio,
        }, eased);
    }, [apply]);

    const actions = useMemo(() => ({
        zoomIn: () => zoomTo(viewRef.current.scale * BUTTON_FACTOR),
        zoomOut: () => zoomTo(viewRef.current.scale / BUTTON_FACTOR),
        zoomTo,
        zoomByWheel: (deltaY: number, point: { x: number; y: number }) =>
            zoomTo(viewRef.current.scale * Math.exp(-deltaY * WHEEL_FACTOR), point, false),
        /** Double-click: fit when zoomed in, otherwise 2x at the clicked point. */
        toggleAt: (point: { x: number; y: number }) =>
            (viewRef.current.scale > 1 ? apply({ ...FIT_VIEW, rotation: viewRef.current.rotation }, true) : zoomTo(2, point)),
        panBy: (dx: number, dy: number, eased = false) =>
            apply({ ...viewRef.current, x: viewRef.current.x + dx, y: viewRef.current.y + dy }, eased),
        rotate: () => apply({ ...viewRef.current, rotation: viewRef.current.rotation + 90 }, true),
        fit: () => apply({ ...FIT_VIEW, rotation: viewRef.current.rotation }, true),
    }), [apply, zoomTo]);

    return { view, animate, ...actions };
}
