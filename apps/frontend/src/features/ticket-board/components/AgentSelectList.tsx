import React from 'react';
import { cn } from '@/lib/utils';

interface Agent {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    site?: { code: string; name: string };
}

const SITE_BADGE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    SMG: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    KRW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    JTB: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
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
    searchQuery = '',
}) => {
    const filtered = searchQuery.trim()
        ? agents.filter(a =>
            a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.email.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : agents;

    if (!isAdmin) {
        // Non-admin: show site header + flat list
        const siteCode = agents[0]?.site?.code;
        return (
            <div>
                {siteCode && (
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-[hsl(var(--border))]">
                        Site {siteCode} • {filtered.length} agent{filtered.length !== 1 ? 's' : ''}
                    </div>
                )}
                {filtered.map(agent => (
                    <AgentRow
                        key={agent.id}
                        agent={agent}
                        selected={selectedId === agent.id}
                        onSelect={onSelect}
                        showBadge
                    />
                ))}
                {filtered.length === 0 && (
                    <div className="px-3 py-6 text-center text-sm text-slate-400">
                        Tidak ada agent ditemukan
                    </div>
                )}
            </div>
        );
    }

    // Admin: group by site
    const groups = filtered.reduce<Record<string, Agent[]>>((acc, agent) => {
        const code = agent.site?.code || 'Unassigned';
        if (!acc[code]) acc[code] = [];
        acc[code].push(agent);
        return acc;
    }, {});

    return (
        <div>
            {Object.entries(groups).map(([siteCode, siteAgents]) => (
                <div key={siteCode}>
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-[hsl(var(--border))]">
                        {siteCode === 'Unassigned' ? 'No Site' : `── ${siteCode} ──`} • {siteAgents.length}
                    </div>
                    {siteAgents.map(agent => (
                        <AgentRow
                            key={agent.id}
                            agent={agent}
                            selected={selectedId === agent.id}
                            onSelect={onSelect}
                            showBadge
                        />
                    ))}
                </div>
            ))}
            {filtered.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-slate-400">
                    Tidak ada agent ditemukan
                </div>
            )}
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
        .slice(0, 2)
        .map(w => w[0])
        .join('')
        .toUpperCase();

    return (
        <button
            type="button"
            onClick={() => onSelect(agent.id)}
            className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100',
                'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                selected && 'bg-blue-50 dark:bg-blue-900/20'
            )}
        >
            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                {agent.avatarUrl ? (
                    <img src={agent.avatarUrl} className="w-7 h-7 rounded-full object-cover" alt="" />
                ) : initials}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 dark:text-white truncate">{agent.fullName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{agent.email}</div>
            </div>
            {showBadge && siteCode && (
                <span className={cn(
                    'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded',
                    SITE_BADGE_COLORS[siteCode] || 'bg-slate-100 text-slate-600'
                )}>
                    {siteCode}
                </span>
            )}
            {selected && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            )}
        </button>
    );
};
