import React, { useEffect } from 'react';
import { X, Download, Copy, Check, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ImageLightboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    altText?: string;
    caption?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
    isOpen,
    onClose,
    imageUrl,
    altText = 'Pratinjau Gambar',
    caption,
}) => {
    const [scale, setScale] = React.useState(1);
    const [copied, setCopied] = React.useState(false);

    useEffect(() => {
        if (isOpen) {
            setScale(1);
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
            return () => {
                window.removeEventListener('keydown', handleKeyDown);
                document.body.style.overflow = '';
            };
        }
    }, [isOpen, onClose]);

    if (!isOpen || !imageUrl) return null;

    const handleCopyUrl = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(imageUrl);
            setCopied(true);
            toast.success('Link gambar disalin ke clipboard');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Gagal menyalin link');
        }
    };

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale((prev) => Math.min(prev + 0.25, 3));
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale((prev) => Math.max(prev - 0.25, 0.5));
    };

    const handleResetZoom = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(1);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 transition-all animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Top Toolbar */}
            <div
                className="w-full max-w-5xl flex items-center justify-between pb-3 text-white/90 z-10"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 max-w-md truncate">
                    <span className="text-xs sm:text-sm font-semibold truncate text-white/90">
                        {caption || altText || 'Pratinjau Gambar'}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                        type="button"
                        onClick={handleZoomOut}
                        disabled={scale <= 0.5}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-40 cursor-pointer"
                        title="Perkecil (-)"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={handleResetZoom}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-xs transition-colors cursor-pointer"
                        title="Reset Ukuran"
                    >
                        {Math.round(scale * 100)}%
                    </button>
                    <button
                        type="button"
                        onClick={handleZoomIn}
                        disabled={scale >= 3}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-40 cursor-pointer"
                        title="Perbesar (+)"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={handleCopyUrl}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                        title="Salin Link Gambar"
                    >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                        href={imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                        title="Buka Gambar Asli"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg bg-white/15 hover:bg-red-500/80 text-white transition-colors cursor-pointer ml-1 sm:ml-2"
                        title="Tutup (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Image Container */}
            <div
                className="relative flex-1 flex flex-col items-center justify-center max-w-6xl w-full max-h-[82vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative max-h-full max-w-full overflow-auto p-2 flex items-center justify-center custom-scrollbar">
                    <img
                        src={imageUrl}
                        alt={altText}
                        style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out' }}
                        className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl border border-white/10 select-none"
                        draggable={false}
                    />
                </div>

                {caption && (
                    <div className="mt-3 px-4 py-1.5 bg-black/60 border border-white/10 rounded-full text-center text-xs sm:text-sm text-white/90 backdrop-blur-sm max-w-2xl truncate">
                        {caption}
                    </div>
                )}
            </div>
        </div>
    );
};
