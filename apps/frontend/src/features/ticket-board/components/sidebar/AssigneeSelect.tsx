import { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';
import { AgentSelectList } from '../AgentSelectList';

interface Agent {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    site?: { code: string; name: string };
}

interface AssigneeSelectProps {
    value?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const AssigneeSelect = ({ value, onChange, disabled }: AssigneeSelectProps) => {
    const [open, setOpen] = useState(false);
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';

    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents', isAdmin ? 'all' : user?.siteId],
        queryFn: async () => {
            const params = new URLSearchParams();
            // Non-admin: filter by own site
            if (!isAdmin && user?.siteId) {
                params.set('siteId', user.siteId);
            }
            const res = await api.get(`/users/agents?${params.toString()}`);
            return res.data;
        },
    });

    const selectedAgent = agents.find((agent) => agent.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled}
                >
                    {selectedAgent ? (
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                {selectedAgent.fullName.charAt(0)}
                            </div>
                            <span className="truncate">{selectedAgent.fullName}</span>
                        </div>
                    ) : (
                        'Select Agent...'
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-72" align="start">
                <AgentSelectList
                    agents={agents}
                    selectedId={value}
                    isAdmin={isAdmin}
                    onSelect={(agentId) => {
                        onChange(agentId);
                        setOpen(false);
                    }}
                />
            </PopoverContent>
        </Popover>
    );
};
