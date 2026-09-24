import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    BookOpen,
    FileText,
    ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/stores/useAuth';
import api from '@/lib/api';

export const GUIDEBOOK_DISMISSED_STORAGE_KEY = 'guidebook_dismissed_session';

export interface UserGuidebookModalProps {
    forceOpen?: boolean;
    onClose?: () => void;
}

export const UserGuidebookModal: React.FC<UserGuidebookModalProps> = ({
    forceOpen,
    onClose,
}) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [guidebookId, setGuidebookId] = useState<string | null>(null);
    const [guidebookTitle, setGuidebookTitle] = useState<string>('Panduan Lengkap Penggunaan Portal User iDesk Enterprise');

    useEffect(() => {
        let isMounted = true;
        api.get('/kb/articles/portal-guidebook')
            .then((res) => {
                if (isMounted && res.data?.id) {
                    setGuidebookId(res.data.id);
                    if (res.data.title) {
                        setGuidebookTitle(res.data.title);
                    }
                }
            })
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (forceOpen !== undefined) {
            setOpen(forceOpen);
            return;
        }

        // Auto-open only for USER role when guidebook is not yet acknowledged
        if (user?.role === 'USER' && !user?.guidebookAcknowledgedAt) {
            const isDismissed = sessionStorage.getItem(GUIDEBOOK_DISMISSED_STORAGE_KEY) === 'true';
            if (!isDismissed) {
                setOpen(true);
            }
        } else {
            setOpen(false);
        }
    }, [user?.role, user?.guidebookAcknowledgedAt, forceOpen]);

    const handleDismiss = () => {
        sessionStorage.setItem(GUIDEBOOK_DISMISSED_STORAGE_KEY, 'true');
        setOpen(false);
        onClose?.();
    };

    const handleOpenArticle = () => {
        handleDismiss();
        if (guidebookId) {
            navigate(`/client/kb/articles/${guidebookId}`);
        } else {
            navigate('/client/kb');
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    handleDismiss();
                }
            }}
        >
            <DialogContent className="w-[92vw] max-w-[480px] p-0 gap-0 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
                <div className="p-6 w-full min-w-0">
                    {/* Header: Clean & Professional */}
                    <div className="flex items-start gap-3.5 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200/70 dark:border-slate-700/60">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1 pr-6">
                            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                                Panduan Penggunaan Portal
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Panduan resmi penggunaan sistem iDesk untuk pengajuan tiket IT, permintaan Oracle/K2, reservasi Zoom, serta perizinan E-Form.
                            </DialogDescription>
                        </div>
                    </div>

                    {/* Article Target Preview as a semantic accessible button */}
                    <button
                        type="button"
                        onClick={handleOpenArticle}
                        className="w-full my-2 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer flex items-center justify-between gap-3 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 shrink-0 transition-colors" />
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-xs text-slate-800 dark:text-slate-200 truncate group-hover:text-primary transition-colors">
                                    {guidebookTitle}
                                </p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                    Knowledge Base • Panduan Pengguna
                                </p>
                            </div>
                        </div>

                        <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0 transition-colors" />
                    </button>

                    {/* Footer: Clean 2-Button Action Bar */}
                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={handleDismiss}
                            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            Nanti Saja
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenArticle}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-sm transition-colors cursor-pointer shrink-0"
                        >
                            <span>Buka Panduan</span>
                            <ArrowUpRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default UserGuidebookModal;
