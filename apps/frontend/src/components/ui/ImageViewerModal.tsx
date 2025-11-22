import React from 'react';
import { X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

interface ImageViewerModalProps {
    isOpen: boolean;
    imageUrl: string | null;
    onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ isOpen, imageUrl, onClose }) => {
    if (!imageUrl) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 outline-none">
                    <div className="relative">
                        <button
                            onClick={onClose}
                            className="absolute -top-12 -right-12 text-white hover:text-neon-green transition-colors"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <img
                            src={imageUrl}
                            alt="Full size"
                            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl border border-white/10"
                        />
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
