import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function RejectDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
    const [reason, setReason] = useState('');

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div className="fixed inset-0 bg-black/40 z-40"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
                    <motion.div role="dialog" aria-modal="true"
                        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.09 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(95vw,440px)] rounded-2xl bg-white shadow-lg z-50 p-5">
                        <h2 className="text-base font-semibold tracking-tight">Tolak Request</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Alasan akan dikirim ke requester.</p>
                        <textarea rows={4} value={reason} onChange={e => setReason(e.target.value)}
                            className="mt-3 w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-900" />
                        <div className="mt-3 flex justify-end gap-2">
                            <button onClick={onClose} className="px-3 py-1.5 rounded-xl ring-1 ring-slate-200 text-sm">Batal</button>
                            <button onClick={() => { onConfirm(reason); onClose(); }}
                                disabled={reason.trim().length < 5}
                                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-sm disabled:opacity-50">Tolak</button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
