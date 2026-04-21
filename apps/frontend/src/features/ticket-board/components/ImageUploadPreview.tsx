import React from 'react';
import { X } from 'lucide-react';

interface ImageUploadPreviewProps {
    files: File[];
    onRemove: (index: number) => void;
}

export const ImageUploadPreview: React.FC<ImageUploadPreviewProps> = ({ files, onRemove }) => {
    if (files.length === 0) return null;

    return (
        <div className="flex gap-2 p-2 overflow-x-auto bg-navy-main border-t border-white/10">
            {files.map((file, index) => (
                <div key={index} className="relative group flex-shrink-0">
                    <img
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        className="w-16 h-16 object-cover rounded-lg border border-white/10"
                    />
                    <button
                        onClick={() => onRemove(index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            ))}
        </div>
    );
};
