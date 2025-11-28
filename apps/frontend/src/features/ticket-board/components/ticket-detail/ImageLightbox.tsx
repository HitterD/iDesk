import React from 'react';
import { X, Download } from 'lucide-react';

interface ImageLightboxProps {
    src: string;
    onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, onClose }) => {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            >
                <X className="w-6 h-6" />
            </button>
            <img
                src={src}
                alt="Attachment"
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            />
            <a
                href={src}
                download
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
                <Download className="w-4 h-4" />
                Download
            </a>
        </div>
    );
};
