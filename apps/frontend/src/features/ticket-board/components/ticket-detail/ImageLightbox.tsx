import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImageLightboxProps {
    src: string;
    onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, onClose }) => {
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Handle escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.25, 3));
            if (e.key === '-') setScale(s => Math.max(s - 0.25, 0.5));
            if (e.key === 'r' || e.key === 'R') setRotation(r => r + 90);
        };
        
        document.addEventListener('keydown', handleKeyDown);
        // Prevent body scroll when lightbox is open
        document.body.style.overflow = 'hidden';
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(s => Math.min(s + 0.25, 3));
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(s => Math.max(s - 0.25, 0.5));
    };

    const handleRotate = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRotation(r => r + 90);
    };

    const lightboxContent = (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
            style={{ zIndex: 99999 }}
            onClick={onClose}
        >
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:scale-110"
                title="Close (Esc)"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Controls */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 rounded-full p-2">
                <button
                    onClick={handleZoomOut}
                    className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                    title="Zoom Out (-)"
                >
                    <ZoomOut className="w-5 h-5" />
                </button>
                <span className="text-white text-sm font-medium min-w-[60px] text-center">
                    {Math.round(scale * 100)}%
                </span>
                <button
                    onClick={handleZoomIn}
                    className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                    title="Zoom In (+)"
                >
                    <ZoomIn className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-white/20 mx-1" />
                <button
                    onClick={handleRotate}
                    className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                    title="Rotate (R)"
                >
                    <RotateCw className="w-5 h-5" />
                </button>
            </div>

            {/* Image container */}
            <div 
                className="flex items-center justify-center w-full h-full p-12"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={src}
                    alt="Attachment"
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
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-6 right-6 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:scale-105"
            >
                <Download className="w-5 h-5" />
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
