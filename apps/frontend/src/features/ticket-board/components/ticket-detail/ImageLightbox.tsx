import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';
import { cn } from '@/lib/utils';
import { MAX_ZOOM, MIN_ZOOM, useZoomPan } from './useZoomPan';
import './image-lightbox.css';

interface ImageLightboxProps {
    /**
     * Already-resolved URL (callers pass what `getAttachmentUrl` returned).
     * Re-running that normalization here stripped the host off an absolute URL and
     * rebuilt it from env, which broke previews whenever the two disagreed.
     */
    src: string;
    /** Describes the image for screen readers; falls back to a generic label. */
    alt?: string;
    onClose: () => void;
}

const ARROW_PAN = 80;
/** A press that moves less than this is a click (close on the backdrop), not a drag. */
const DRAG_THRESHOLD = 4;

/**
 * Full-screen image preview: scroll or pinch to zoom where the cursor is, drag to move a zoomed image,
 * double-click to switch between "fit" and 2x, plus buttons and keyboard (+ - 0 R, arrows, Esc).
 */
export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, onClose }) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const gesture = useRef({ moved: 0, pinchDistance: 0, onBackdrop: false });
    const [dragging, setDragging] = useState(false);

    const stageSize = useCallback(() => ({ width: stageRef.current?.clientWidth ?? 0, height: stageRef.current?.clientHeight ?? 0 }), []);
    const imageSize = useCallback(() => ({ width: imageRef.current?.offsetWidth ?? 0, height: imageRef.current?.offsetHeight ?? 0 }), []);
    const zoom = useZoomPan(stageSize, imageSize);
    const { view } = zoom;
    const { zoomIn, zoomOut, fit, rotate, panBy, zoomByWheel } = zoom;

    useFocusTrap(dialogRef, { enabled: true, onEscape: onClose });

    /** Point relative to the stage centre, the origin the transform works in. */
    const fromCentre = (clientX: number, clientY: number) => {
        const rect = stageRef.current!.getBoundingClientRect();
        return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === '+' || e.key === '=') zoomIn();
            else if (e.key === '-') zoomOut();
            else if (e.key === '0') fit();
            else if (e.key === 'r' || e.key === 'R') rotate();
            else if (e.key === 'ArrowLeft') panBy(ARROW_PAN, 0, true);
            else if (e.key === 'ArrowRight') panBy(-ARROW_PAN, 0, true);
            else if (e.key === 'ArrowUp') panBy(0, ARROW_PAN, true);
            else if (e.key === 'ArrowDown') panBy(0, -ARROW_PAN, true);
            else return;
            e.preventDefault();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [zoomIn, zoomOut, fit, rotate, panBy]);

    useEffect(() => {
        // Ref-counted: the lightbox opens from inside the ticket detail modal,
        // so a naive reset would restore scrolling while that modal is still up.
        lockBodyScroll();
        return () => unlockBodyScroll();
    }, []);

    // Native, non-passive listener: React's onWheel cannot preventDefault the page zoom/scroll.
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            zoomByWheel(e.deltaY, fromCentre(e.clientX, e.clientY));
        };
        stage.addEventListener('wheel', onWheel, { passive: false });
        return () => stage.removeEventListener('wheel', onWheel);
    }, [zoomByWheel]);

    const onPointerDown = (e: React.PointerEvent) => {
        // Read before capturing: afterwards every event of this pointer targets the stage itself.
        gesture.current.onBackdrop = e.target === e.currentTarget;
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        gesture.current.moved = 0;
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            gesture.current.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
        }
        setDragging(pointers.current.size === 1 && view.scale > 1);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const previous = pointers.current.get(e.pointerId);
        if (!previous) return;
        const point = { x: e.clientX, y: e.clientY };
        pointers.current.set(e.pointerId, point);
        gesture.current.moved += Math.hypot(point.x - previous.x, point.y - previous.y);
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            if (gesture.current.pinchDistance > 0) {
                const centre = fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2);
                zoom.zoomTo(view.scale * (distance / gesture.current.pinchDistance), centre, false);
            }
            gesture.current.pinchDistance = distance;
        } else if (view.scale > 1) {
            zoom.panBy(point.x - previous.x, point.y - previous.y);
        }
    };

    const onPointerUp = (e: React.PointerEvent) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) gesture.current.pinchDistance = 0;
        setDragging(false);
        // A plain click on the dark area (not the image) closes, like other viewers.
        if (gesture.current.moved < DRAG_THRESHOLD && gesture.current.onBackdrop && pointers.current.size === 0) onClose();
    };

    const stop = (e: React.SyntheticEvent) => e.stopPropagation();
    const percent = Math.round(view.scale * 100);

    const content = (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={alt || 'Pratinjau gambar'} className="ilb">
            <div className="ilb-bar" onPointerDown={stop}>
                <button type="button" className="ilb-btn" onClick={zoom.zoomOut} disabled={view.scale <= MIN_ZOOM} aria-label="Perkecil" title="Perkecil (-)">
                    <ZoomOut aria-hidden="true" />
                </button>
                <button type="button" className="ilb-pct" onClick={zoom.fit} title="Sesuaikan ke layar (0)" aria-label={`Zoom ${percent}%, klik untuk menyesuaikan ke layar`}>
                    {percent}%
                </button>
                <button type="button" className="ilb-btn" onClick={zoom.zoomIn} disabled={view.scale >= MAX_ZOOM} aria-label="Perbesar" title="Perbesar (+)">
                    <ZoomIn aria-hidden="true" />
                </button>
                <span className="ilb-sep" aria-hidden="true" />
                <button type="button" className="ilb-btn" onClick={zoom.fit} disabled={view.scale === 1 && view.x === 0 && view.y === 0} aria-label="Sesuaikan ke layar" title="Sesuaikan ke layar (0)">
                    <Maximize2 aria-hidden="true" />
                </button>
                <button type="button" className="ilb-btn" onClick={zoom.rotate} aria-label="Putar gambar" title="Putar (R)">
                    <RotateCw aria-hidden="true" />
                </button>
            </div>

            <button type="button" className="ilb-btn ilb-close" onClick={onClose} aria-label="Tutup pratinjau" title="Tutup (Esc)">
                <X aria-hidden="true" />
            </button>

            <div
                ref={stageRef}
                className={cn('ilb-stage', view.scale > 1 && 'is-zoomed', dragging && 'is-dragging')}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={(e) => zoom.toggleAt(fromCentre(e.clientX, e.clientY))}
            >
                <img
                    ref={imageRef}
                    src={src}
                    alt={alt || 'Lampiran'}
                    className={cn('ilb-img', zoom.animate && 'is-eased')}
                    style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale}) rotate(${view.rotation}deg)` }}
                    draggable={false}
                />
            </div>

            <div className="ilb-foot" onPointerDown={stop}>
                <p className="ilb-hint">Scroll untuk zoom · seret untuk geser · klik dua kali untuk 2×</p>
                <a href={src} download target="_blank" rel="noopener noreferrer" className="ilb-download">
                    <Download aria-hidden="true" />Unduh
                </a>
            </div>
        </div>
    );

    // Portal: true full screen even when opened from inside another modal.
    return createPortal(content, document.body);
};
