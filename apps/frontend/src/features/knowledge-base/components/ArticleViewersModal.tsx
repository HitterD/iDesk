import React, { useState, useMemo } from 'react';
import {
    X,
    Search,
    Users,
    Clock,
    Shield,
    Briefcase,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ViewerItem {
    id: string;
    userId?: string;
    fullName: string;
    avatarUrl?: string;
    jobTitle?: string;
    role?: string;
    lastViewedAt: string | Date;
}

interface ArticleViewersModalProps {
    isOpen: boolean;
    onClose: () => void;
    viewers: ViewerItem[];
    articleTitle: string;
}

function formatRelativeTime(dateStr: string | Date): string {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return 'Baru saja';
        if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`;
        if (diffHours < 24) return `${diffHours} jam yang lalu`;
        if (diffDays === 1) return 'Kemarin';
        if (diffDays < 7) return `${diffDays} hari yang lalu`;

        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '';
    }
}

function getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

export const ArticleViewersModal: React.FC<ArticleViewersModalProps> = ({
    isOpen,
    onClose,
    viewers,
    articleTitle,
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredViewers = useMemo(() => {
        if (!searchQuery.trim()) return viewers;
        const q = searchQuery.toLowerCase();
        return viewers.filter(
            (v) =>
                v.fullName?.toLowerCase().includes(q) ||
                v.jobTitle?.toLowerCase().includes(q) ||
                v.role?.toLowerCase().includes(q)
        );
    }, [viewers, searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
            <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-5 border-b border-border flex items-start justify-between gap-3 bg-muted/20">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-foreground font-bold text-base">
                            <Users className="w-4 h-4 text-primary" />
                            <h3>Daftar Pembaca Artikel</h3>
                            <span className="px-2 py-0.5 rounded-full bg-muted font-mono text-xs font-semibold text-muted-foreground border border-border">
                                {viewers.length} Karyawan
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                            {articleTitle}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Tutup"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-3 border-b border-border/80 bg-background">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari nama karyawan atau jabatan..."
                            className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Viewers List */}
                <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-1.5">
                    {filteredViewers.length > 0 ? (
                        filteredViewers.map((viewer, idx) => {
                            const initials = getInitials(viewer.fullName);
                            const roleBadgeColor =
                                viewer.role === 'admin'
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                    : viewer.role === 'agent'
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                    : 'bg-muted text-muted-foreground border-border';

                            return (
                                <div
                                    key={viewer.id || idx}
                                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border/60 hover:border-border hover:bg-muted/30 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {/* Avatar */}
                                        {viewer.avatarUrl ? (
                                            <img
                                                src={viewer.avatarUrl}
                                                alt={viewer.fullName}
                                                className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                                            />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-muted border border-border text-foreground font-mono text-xs font-bold flex items-center justify-center shrink-0">
                                                {initials}
                                            </div>
                                        )}

                                        {/* User Details */}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-xs text-foreground truncate">
                                                    {viewer.fullName}
                                                </span>
                                                <span className={cn("px-1.5 py-0.2 rounded font-mono text-[9px] uppercase font-bold border", roleBadgeColor)}>
                                                    {viewer.role || 'User'}
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-muted-foreground truncate block">
                                                {viewer.jobTitle || 'Karyawan'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Timestamp */}
                                    <div className="text-right shrink-0">
                                        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-muted-foreground/70" />
                                            <span>{formatRelativeTime(viewer.lastViewedAt)}</span>
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground">Tidak ada pembaca yang sesuai</p>
                            <p>Coba kata kunci pencarian yang lain.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-border bg-muted/10 text-right">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
};
