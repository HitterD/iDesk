import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';

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

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, onClose }) => {
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap(dialogRef, { enabled: true, onEscape: onClose });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + SCALE_STEP, MAX_SCALE));
            if (e.key === '-') setScale(s => Math.max(s - SCALE_STEP, MIN_SCALE));
            // Keep the angle bounded — an unbounded counter drifts past what
            // transform can express meaningfully after enough presses.
            if (e.key === 'r' || e.key === 'R') setRotation(r => (r + 90) % 360);
        };

        document.addEventListener('keydown', handleKeyDown);
        // Ref-counted: the lightbox opens from inside the ticket detail modal,
        // so a naive reset would restore scrolling while that modal is still up.
        lockBodyScroll();

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            unlockBodyScroll();
        };
    }, []);

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(s => Math.min(s + SCALE_STEP, MAX_SCALE));
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(s => Math.max(s - SCALE_STEP, MIN_SCALE));
    };

    const handleRotate = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRotation(r => (r + 90) % 360);
    };

    const lightboxContent = (
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={alt || 'Image preview'}
            className="fixed inset-0 flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
            style={{ zIndex: 99999 }}
            onClick={onClose}
        >
            {/* Close button */}
            <button
                type="button"
                onClick={onClose}
                aria-label="Close image preview"
                className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:scale-110"
                title="Close (Esc)"
            >
                <X className="w-6 h-6" aria-hidden="true" />
            </button>

            {/* Controls */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 rounded-full p-2">
                <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={scale <= MIN_SCALE}
                    aria-label="Zoom out"
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-colors disabled:opacity-40"
                    title="Zoom Out (-)"
                >
                    <ZoomOut className="w-5 h-5" aria-hidden="true" />
                </button>
                <span className="text-white text-sm font-medium min-w-[60px] text-center tabular-nums" aria-live="polite">
                    {Math.round(scale * 100)}%
                </span>
                <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={scale >= MAX_SCALE}
                    aria-label="Zoom in"
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-colors disabled:opacity-40"
                    title="Zoom In (+)"
                >
                    <ZoomIn className="w-5 h-5" aria-hidden="true" />
                </button>
                <div className="w-px h-6 bg-white/20 mx-1" />
                <button
                    type="button"
                    onClick={handleRotate}
                    aria-label="Rotate image"
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-colors"
                    title="Rotate (R)"
                >
                    <RotateCw className="w-5 h-5" aria-hidden="true" />
                </button>
            </div>

            {/* Image container */}
            <div 
                className="flex items-center justify-center w-full h-full p-12"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={src}
                    alt={alt || 'Attachment preview'}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-200"
                    style={{ 
                        transform: `scale(${scale}) rotate(${rotation}deg)`,
                        maxWidth: '90vw',
                        maxHeight: '85vh'
                    }}
                    draggable={false}
                />
            </div>

            {/* Download button */}
            <a
                href={src}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-6 right-6 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:scale-105"
            >
                <Download className="w-5 h-5" aria-hidden="true" />
                Download
            </a>

            {/* Keyboard shortcuts hint */}
            <div className="absolute bottom-6 left-6 text-white/50 text-xs">
                <span className="bg-white/10 px-2 py-1 rounded mr-2">Esc</span> Close
                <span className="bg-white/10 px-2 py-1 rounded mx-2">+/-</span> Zoom
                <span className="bg-white/10 px-2 py-1 rounded mx-2">R</span> Rotate
            </div>
        </div>
    );

    // Use portal to render at document body level for true fullscreen
    return createPortal(lightboxContent, document.body);
};
