import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Laptop, Smartphone, CreditCard, Key, Backpack, Box } from 'lucide-react';
import { LostItemReport } from '../api/lost-item.api';
import { StatusBadge } from './StatusBadge';

interface LostItemCardProps {
    item: LostItemReport;
    onClick: () => void;
}

export function LostItemCard({ item, onClick }: LostItemCardProps) {
    const getItemIcon = (type: string) => {
        if (!type) return <Box className="w-5 h-5 text-slate-500" />;
        const t = type.toLowerCase();
        if (t.includes('laptop')) return <Laptop className="w-5 h-5 text-slate-500" />;
        if (t.includes('hp') || t.includes('phone') || t.includes('handphone')) return <Smartphone className="w-5 h-5 text-slate-500" />;
        if (t.includes('id') || t.includes('card') || t.includes('badge')) return <CreditCard className="w-5 h-5 text-slate-500" />;
        if (t.includes('kunci') || t.includes('key')) return <Key className="w-5 h-5 text-slate-500" />;
        if (t.includes('tas') || t.includes('bag')) return <Backpack className="w-5 h-5 text-slate-500" />;
        return <Box className="w-5 h-5 text-slate-500" />;
    };

    return (
        <div
            onClick={onClick}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden flex flex-col h-full"
        >
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                    <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg">
                        {getItemIcon(item.itemType)}
                    </div>
                    <StatusBadge status={item.status} />
                </div>
                
                <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1 truncate" title={item.itemName}>
                    {item.itemName}
                </h3>

                <div className="space-y-1 mb-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate" title={item.lastSeenLocation}>
                        📍 {item.lastSeenLocation}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        🕒 {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: idLocale })}
                    </p>
                </div>

                {item.status === 'CLAIMED' && (
                    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-100 dark:border-slate-700">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Ada laporan penemu</span>
                    </div>
                )}
            </div>

            {item.photoUrls && item.photoUrls.length > 0 ? (
                <div className="h-32 w-full bg-slate-100 dark:bg-slate-700 border-t border-slate-100 dark:border-slate-700">
                    <img
                        src={item.photoUrls[0]}
                        alt={item.itemName}
                        className="w-full h-full object-cover"
                    />
                </div>
            ) : (
                <div className="h-32 w-full bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700 flex items-center justify-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500">Tidak ada foto</span>
                </div>
            )}
        </div>
    );
}
