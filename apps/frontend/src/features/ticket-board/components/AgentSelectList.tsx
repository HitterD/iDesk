import { useMemo, useState } from 'react';
import { Check, UserX } from 'lucide-react';
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from '@/components/ui/command';
import { DashAvatar } from '@/features/dashboard/components/DashboardParts';

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

const UNASSIGNED_VALUE = '__unassigned__';

function AgentRow({ agent, selected, onSelect }: { agent: Agent; selected: boolean; onSelect: (id: string) => void }) {
    const admin = agent.role === 'ADMIN' || agent.role === 'AGENT_ADMIN';
    return <CommandItem value={agent.id} onSelect={() => onSelect(agent.id)} data-checked={selected} aria-checked={selected}
        className="picker-option agent-option" aria-label={`${agent.fullName} ${agent.email} ${agent.site?.code || ''}`}>
        {agent.avatarUrl
            ? <img src={agent.avatarUrl} className="dash-avatar object-cover" alt="" aria-hidden="true" />
            : <DashAvatar name={agent.fullName} />}
        <span className="agent-option-text">
            <span className="agent-option-name">
                <span className="truncate" title={agent.fullName}>{agent.fullName}</span>
                {admin && <span className="agent-option-tag is-admin">Admin</span>}
            </span>
            <span className="agent-option-email">{agent.email}</span>
        </span>
        {agent.site?.code && <span className="agent-option-tag">{agent.site.code}</span>}
        <Check aria-hidden="true" className="agent-option-check" />
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
    return <Command className="agent-select-list" label="Cari agent atau site…" shouldFilter={false} loop defaultValue={selectedId || UNASSIGNED_VALUE}>
        <CommandInput autoFocus placeholder="Cari agent atau site…" aria-label="Cari agent atau site…"
            value={query} onValueChange={setInternalSearch} readOnly={searchQuery !== undefined} />
        <CommandList className="agent-select-scroll">
            <CommandGroup>
                <CommandItem value={UNASSIGNED_VALUE} onSelect={() => onSelect('')} data-checked={!selectedId} aria-checked={!selectedId} className="picker-option agent-option">
                    <span className="agent-option-none" aria-hidden="true"><UserX /></span>
                    <span className="agent-option-text"><span className="agent-option-name">Unassigned (Lepas Penugasan)</span>
                        <span className="agent-option-email">Biarkan tiket tanpa PIC agent</span></span>
                    <Check aria-hidden="true" className="agent-option-check" />
                </CommandItem>
            </CommandGroup>
            <AgentGroups agents={filtered} selectedId={selectedId} onSelect={onSelect} />
            {filtered.length === 0 && <div role="status" className="agent-select-empty">
                <p>Tidak ada agent ditemukan</p>
                <small>Coba cari dengan kata kunci nama atau site lain.</small>
            </div>}
        </CommandList>
        <div className="agent-select-foot">{filtered.length} agent</div>
    </Command>;
};
