import React, { useState } from 'react';
import { Users, Eye, ChevronRight } from 'lucide-react';
import { ArticleViewersModal, ViewerItem } from './ArticleViewersModal';
import { cn } from '@/lib/utils';

interface ArticleViewersStackProps {
    viewers: ViewerItem[];
    totalCount: number;
    articleTitle: string;
    className?: string;
}

function getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

export const ArticleViewersStack: React.FC<ArticleViewersStackProps> = ({
    viewers = [],
    totalCount,
    articleTitle,
    className,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const displayViewers = viewers.slice(0, 4);
    const extraCount = Math.max(0, (totalCount || viewers.length) - displayViewers.length);

    if (viewers.length === 0 && totalCount === 0) {
        return null;
    }

    return (
        <>
            <div className={cn("inline-flex items-center gap-2", className)}>
                {/* Overlapping Avatar Stack */}
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center -space-x-2 overflow-hidden hover:opacity-90 transition-opacity cursor-pointer group"
                    title="Klik untuk melihat daftar seluruh pembaca artikel"
                >
                    {displayViewers.map((viewer, idx) => {
                        const initials = getInitials(viewer.fullName);
                        return (
                            <div
                                key={viewer.id || idx}
                                className="relative inline-block w-7 h-7 rounded-full ring-2 ring-card bg-muted border border-border overflow-hidden shrink-0 group-hover:scale-105 transition-transform"
                                style={{ zIndex: 10 - idx }}
                                title={`${viewer.fullName} (${viewer.jobTitle || 'Karyawan'})`}
                            >
                                {viewer.avatarUrl ? (
                                    <img
                                        src={viewer.avatarUrl}
                                        alt={viewer.fullName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="w-full h-full flex items-center justify-center font-mono text-[10px] font-bold text-foreground">
                                        {initials}
                                    </span>
                                )}
                            </div>
                        );
                    })}

                    {extraCount > 0 && (
                        <div
                            className="relative inline-flex items-center justify-center w-7 h-7 rounded-full ring-2 ring-card bg-foreground text-background font-mono text-[10px] font-bold shrink-0"
                            style={{ zIndex: 5 }}
                        >
                            +{extraCount}
                        </div>
                    )}
                </button>

                {/* Text Trigger Button */}
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                    <span>Dilihat {totalCount || viewers.length} orang</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/80" />
                </button>
            </div>

            {/* Viewers Detail Modal */}
            <ArticleViewersModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                viewers={viewers}
                articleTitle={articleTitle}
            />
        </>
    );
};
