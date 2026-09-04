import React, { useState, useMemo } from 'react';
import { Search, X, Check, UserX, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Agent {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    site?: { code?: string; name?: string };
}

const SITE_BADGE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    SMG: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    KRW: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    JTB: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
};

interface AgentSelectListProps {
    agents: Agent[];
    selectedId?: string | null;
    isAdmin: boolean;
    onSelect: (agentId: string) => void;
    searchQuery?: string;
}

export const AgentSelectList: React.FC<AgentSelectListProps> = ({
    agents,
    selectedId,
    isAdmin,
    onSelect,
    searchQuery: externalSearchQuery,
}) => {
    const [internalSearch, setInternalSearch] = useState('');
    const query = externalSearchQuery !== undefined ? externalSearchQuery : internalSearch;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return agents;
        return agents.filter(a =>
            a.fullName.toLowerCase().includes(q) ||
            a.email.toLowerCase().includes(q) ||
            (a.site?.code && a.site.code.toLowerCase().includes(q))
        );
    }, [agents, query]);

    // Grouping by Site for all users
    const groups = useMemo(() => {
        return filtered.reduce<Record<string, Agent[]>>((acc, agent) => {
            const code = agent.site?.code || 'Unassigned';
            if (!acc[code]) acc[code] = [];
            acc[code].push(agent);
            return acc;
        }, {});
    }, [filtered]);

    return (
        <div className="flex flex-col w-full max-h-[380px] bg-card text-card-foreground select-none">
            {/* Sticky Search Bar */}
            <div className="p-2 border-b border-border bg-muted/40 sticky top-0 z-20">
                <div className="relative flex items-center">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setInternalSearch(e.target.value)}
                        placeholder="Cari agent atau site…"
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-background border border-border/80 rounded-lg outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition-all"
                        autoFocus
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setInternalSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Scrollable Agent List Container */}
            <div className="overflow-y-auto max-h-[310px] custom-scrollbar divide-y divide-border/40">
                {/* Unassign Option */}
                <div className="p-1">
                    <button
                        type="button"
                        onClick={() => onSelect('')}
                        className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg transition-colors cursor-pointer',
                            'hover:bg-destructive/10 hover:text-destructive',
                            !selectedId && 'bg-muted/80 text-foreground font-semibold'
                        )}
                    >
                        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                            <UserX className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold">Unassigned (Lepas Penugasan)</div>
                            <div className="text-[10px] text-muted-foreground">Biarkan tiket tanpa PIC agent</div>
                        </div>
                        {!selectedId && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                </div>

                {/* Grouped Agents by Site */}
                {Object.entries(groups).map(([siteCode, siteAgents]) => {
                    if (siteAgents.length === 0) return null;
                    return (
                        <div key={siteCode} className="relative">
                            {/* Sticky Site Group Header */}
                            <div className="sticky top-0 z-10 px-3 py-1 bg-muted/95 backdrop-blur-xs text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between border-y border-border/60">
                                <span className="flex items-center gap-1.5">
                                    <Users className="w-3 h-3 text-primary/70" />
                                    {siteCode === 'Unassigned' ? 'Tanpa Site' : `Site ${siteCode}`}
                                </span>
                                <span className="px-1.5 py-0.2 rounded-full bg-background text-muted-foreground font-mono text-[9px]">
                                    {siteAgents.length}
                                </span>
                            </div>

                            {/* Agent Rows */}
                            <div className="p-1 space-y-0.5">
                                {siteAgents.map(agent => (
                                    <AgentRow
                                        key={agent.id}
                                        agent={agent}
                                        selected={selectedId === agent.id}
                                        onSelect={onSelect}
                                        showBadge={true}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}

                {/* Empty State */}
                {filtered.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground space-y-1">
                        <Users className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="font-semibold text-foreground">Tidak ada agent ditemukan</p>
                        <p className="text-[11px]">Coba cari dengan kata kunci nama atau site lain.</p>
                    </div>
                )}
            </div>

            {/* Footer Status */}
            <div className="px-3 py-1.5 bg-muted/30 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Total: {filtered.length} agent</span>
                <span className="text-[9px] opacity-70">Scroll untuk melihat lainnya</span>
            </div>
        </div>
    );
};

const AgentRow: React.FC<{
    agent: Agent;
    selected: boolean;
    onSelect: (id: string) => void;
    showBadge: boolean;
}> = ({ agent, selected, onSelect, showBadge }) => {
    const siteCode = agent.site?.code;
    const initials = agent.fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0])
        .join('')
        .toUpperCase() || 'AG';

    return (
        <button
            type="button"
            onClick={() => onSelect(agent.id)}
            className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-lg transition-all duration-150 cursor-pointer',
                'hover:bg-muted/80',
                selected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'
            )}
        >
            <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors',
                selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'
            )}>
                {agent.avatarUrl ? (
                    <img src={agent.avatarUrl} className="w-7 h-7 rounded-full object-cover" alt="" />
                ) : initials}
            </div>

            <div className="flex-1 min-w-0 leading-tight">
                <div className="text-xs font-semibold truncate text-foreground flex items-center gap-1.5">
                    <span className="truncate">{agent.fullName}</span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{agent.email}</div>
            </div>

            {showBadge && siteCode && (
                <span className={cn(
                    'shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase',
                    SITE_BADGE_COLORS[siteCode] || 'bg-muted text-muted-foreground border-border'
                )}>
                    {siteCode}
                </span>
            )}

            {selected && (
                <Check className="w-4 h-4 text-primary shrink-0 ml-1" />
            )}
        </button>
    );
};
