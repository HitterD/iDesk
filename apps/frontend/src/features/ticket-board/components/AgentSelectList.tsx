import { useMemo, useState } from 'react';
import { Check, UserX } from 'lucide-react';
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from '@/components/ui/command';
import { TicketPill, type TicketPillTone } from '@/components/ui/ticket-pill';
import { cn } from '@/lib/utils';

export interface Agent {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    site?: { code?: string; name?: string };
}

interface AgentSelectListProps {
    agents: Agent[];
    selectedId?: string | null;
    isAdmin: boolean;
    onSelect: (agentId: string) => void;
    searchQuery?: string;
}

const SITE_TONES: Record<string, TicketPillTone> = { SPJ: 'blue', SMG: 'green', KRW: 'amber', JTB: 'teal' };
const UNASSIGNED_VALUE = '__unassigned__';

function AgentRow({ agent, selected, onSelect }: { agent: Agent; selected: boolean; onSelect: (id: string) => void }) {
    const initials = agent.fullName.split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'AG';
    const admin = agent.role === 'ADMIN' || agent.role === 'AGENT_ADMIN';
    return <CommandItem value={agent.id} onSelect={() => onSelect(agent.id)} data-checked={selected} aria-checked={selected}
        className="picker-option gap-2.5" aria-label={`${agent.fullName} ${agent.email} ${agent.site?.code || ''}`}>
        <span aria-hidden="true" className={cn('h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
            selected ? 'bg-[hsl(var(--idesk-selection))] text-[hsl(var(--idesk-sapphire))]' : 'bg-muted text-muted-foreground')}>
            {agent.avatarUrl ? <img src={agent.avatarUrl} className="h-7 w-7 rounded-full object-cover" alt="" /> : initials}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="truncate" title={agent.fullName}>{agent.fullName}</span>
                {admin && <TicketPill tone="amber" className="min-h-0 px-1.5 py-0 text-[10px]">Admin</TicketPill>}
            </span>
            <span className="picker-description block truncate">{agent.email}</span>
        </span>
        {agent.site?.code && <TicketPill tone={SITE_TONES[agent.site.code] || 'neutral'} className="min-h-0 px-1.5 py-0 text-[10px] shrink-0">{agent.site.code}</TicketPill>}
        {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[hsl(var(--idesk-sapphire))]" />}
    </CommandItem>;
}

function AgentGroups({ agents, selectedId, onSelect }: Pick<AgentSelectListProps, 'agents' | 'selectedId' | 'onSelect'>) {
    const sites = [...new Set(agents.map(agent => agent.site?.code || 'Unassigned'))];
    return sites.map(code => <CommandGroup key={code} heading={code === 'Unassigned' ? 'Tanpa Site' : `Site ${code}`}>
        {agents.filter(agent => (agent.site?.code || 'Unassigned') === code).map(agent =>
            <AgentRow key={agent.id} agent={agent} selected={selectedId === agent.id} onSelect={onSelect} />)}
    </CommandGroup>);
}

export const AgentSelectList = ({ agents, selectedId, onSelect, searchQuery }: AgentSelectListProps) => {
    const [internalSearch, setInternalSearch] = useState('');
    const query = searchQuery !== undefined ? searchQuery : internalSearch;
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return agents.filter(agent => !q || [agent.fullName, agent.email, agent.site?.code || ''].some(text => text.toLowerCase().includes(q)));
    }, [agents, query]);
    return <Command className="agent-select-list max-h-[380px]" label="Cari agent atau site…" shouldFilter={false} loop defaultValue={selectedId || UNASSIGNED_VALUE}>
        <CommandInput autoFocus placeholder="Cari agent atau site…" aria-label="Cari agent atau site…"
            value={query} onValueChange={setInternalSearch} readOnly={searchQuery !== undefined} />
        <CommandList className="min-h-0 max-h-[310px] custom-scrollbar">
            <CommandGroup>
                <CommandItem value={UNASSIGNED_VALUE} onSelect={() => onSelect('')} data-checked={!selectedId} aria-checked={!selectedId} className="picker-option gap-2.5">
                    <UserX aria-hidden="true" className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Unassigned (Lepas Penugasan)</span>
                        <span className="picker-description">Biarkan tiket tanpa PIC agent</span></span>
                    {!selectedId && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                </CommandItem>
            </CommandGroup>
            <AgentGroups agents={filtered} selectedId={selectedId} onSelect={onSelect} />
            {filtered.length === 0 && <div role="status" className="px-4 py-8 text-center text-xs">
                <p className="font-semibold">Tidak ada agent ditemukan</p>
                <p className="picker-description">Coba cari dengan kata kunci nama atau site lain.</p>
            </div>}
        </CommandList>
        <div className="px-3 py-1.5 border-t border-border text-[10px] picker-description">Total: {filtered.length} agent</div>
    </Command>;
};
