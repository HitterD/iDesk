import React, { useRef, useState } from 'react';
import { ImagePlus, X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoUploaderProps {
    files: File[];
    onChange: (files: File[]) => void;
    maxFiles?: number;
    className?: string;
}

export const PhotoUploader = ({ files, onChange, maxFiles = 5, className }: PhotoUploaderProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const previews = files.map(f => URL.createObjectURL(f));

    const addFiles = (incoming: File[]) => {
        const valid = incoming.filter(f => f.type.startsWith('image/'));
        const next = [...files, ...valid].slice(0, maxFiles);
        onChange(next);
    };

    const remove = (idx: number) => {
        const next = files.filter((_, i) => i !== idx);
        onChange(next);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
    };

    return (
        <div className={cn('space-y-3', className)}>
            <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                    'border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors duration-150',
                    dragging
                        ? 'border-rose-400 bg-rose-50/20 dark:bg-rose-900/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-rose-400/50 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                    files.length >= maxFiles && 'opacity-50 pointer-events-none'
                )}
            >
                <Upload className="w-7 h-7 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {files.length >= maxFiles
                        ? `Max ${maxFiles} foto tercapai`
                        : `Drag & drop atau klik · max ${maxFiles} foto`}
                </p>
                <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP · max 5MB</p>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => addFiles(Array.from(e.target.files || []))}
            />

            {previews.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                    {previews.map((src, idx) => (
                        <div key={idx} className="relative group aspect-square">
                            <img
                                src={src}
                                alt={`photo-${idx}`}
                                className="w-full h-full object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                            />
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); remove(idx); }}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {files.length < maxFiles && (
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="aspect-square rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:border-rose-400 hover:text-rose-400 transition-colors"
                        >
                            <ImagePlus className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
