import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PackageSearch, ClipboardList, PackageCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/stores/useAuth';
import { useFoundClaims, FoundClaimStatus } from '../api/found-claim.api';

export const LostItemsNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const isAdminOrAgent = user?.role === 'ADMIN' || user?.role === 'AGENT';

    const isClient = location.pathname.startsWith('/client');
    const isManager = location.pathname.startsWith('/manager');
    const basePath = isClient ? '/client/lost-items' : isManager ? '/manager/lost-items' : '/lost-items';
    const foundPath = isClient ? '/client/found' : isManager ? '/manager/found' : '/found';
    const claimsPath = isClient ? '/client/lost-items/claims' : isManager ? '/manager/lost-items/claims' : '/lost-items/claims';

    const { data: pendingClaims } = useFoundClaims(
        isAdminOrAgent ? { status: FoundClaimStatus.PENDING } : undefined
    );
    const pendingCount = pendingClaims?.length || 0;

    const tabs = [
        { id: 'all', label: 'Semua Laporan', path: basePath, icon: PackageSearch, exact: true, show: true },
        { id: 'my', label: 'Laporan Saya', path: `${basePath}/my`, icon: ClipboardList, exact: false, show: true },
        { id: 'found', label: 'Saya Temukan', path: foundPath, icon: PackageCheck, exact: false, show: true },
        { id: 'claims', label: 'Claims Queue', path: claimsPath, icon: AlertCircle, exact: false, show: isAdminOrAgent, badge: pendingCount },
    ].filter(t => t.show);

    const isActive = (path: string, exact: boolean) => exact ? location.pathname === path : location.pathname.startsWith(path);

    return (
        <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl w-fit">
            {tabs.map(tab => {
                const active = isActive(tab.path, tab.exact);
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => navigate(tab.path)}
                        className={cn(
                            'relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200',
                            active
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                        {tab.badge && tab.badge > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                                {tab.badge > 9 ? '9+' : tab.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};
