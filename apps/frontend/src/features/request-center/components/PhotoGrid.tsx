import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Plus, X, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoGridProps {
    urls: string[];
    editable?: boolean;
    maxDisplay?: number;
    onUpload?: (files: File[]) => void;
    onRemove?: (index: number) => void;
    className?: string;
}

export const PhotoGrid = ({ urls, editable = false, maxDisplay = 5, onUpload, onRemove, className }: PhotoGridProps) => {
    const [lightbox, setLightbox] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length && onUpload) onUpload(files);
        e.target.value = '';
    };

    return (
        <>
            <div className={cn('flex flex-wrap gap-2', className)}>
                {urls.slice(0, maxDisplay).map((url, i) => (
                    <div key={i} className="relative group">
                        <img
                            src={url}
                            alt={`foto-${i + 1}`}
                            onClick={() => setLightbox(url)}
                            className="w-16 h-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ZoomIn className="w-4 h-4 text-white drop-shadow" />
                        </div>
                        {editable && onRemove && (
                            <button
                                onClick={() => onRemove(i)}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        )}
                    </div>
                ))}

                {urls.length === 0 && !editable && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                        <Image className="w-4 h-4" />
                        <span>Tidak ada foto</span>
                    </div>
                )}

                {editable && urls.length < maxDisplay && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center cursor-pointer hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors">
                        <Plus className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-400 mt-0.5">Foto</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                    </label>
                )}
            </div>

            <AnimatePresence>
                {lightbox && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center"
                            onClick={() => setLightbox(null)}
                        >
                            <motion.img
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                src={lightbox}
                                alt="preview"
                                className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
                                onClick={e => e.stopPropagation()}
                            />
                            <button
                                onClick={() => setLightbox(null)}
                                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
