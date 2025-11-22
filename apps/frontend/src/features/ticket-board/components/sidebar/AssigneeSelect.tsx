import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import api from '@/lib/api';

interface Agent {
    id: string;
    fullName: string;
    email: string;
}

interface AssigneeSelectProps {
    value?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const AssigneeSelect = ({ value, onChange, disabled }: AssigneeSelectProps) => {
    const [open, setOpen] = useState(false);
    const [agents, setAgents] = useState<Agent[]>([]);


    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const response = await api.get('/agents');
                setAgents(response.data);
            } catch (error) {
                console.error('Failed to fetch agents:', error);
            }
        };
        fetchAgents();
    }, []);

    const selectedAgent = agents.find((agent) => agent.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
                    disabled={disabled}
                >
                    {value ? (
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-neon-green/20 flex items-center justify-center text-neon-green text-xs font-bold">
                                {selectedAgent?.fullName.charAt(0)}
                            </div>
                            {selectedAgent?.fullName}
                        </div>
                    ) : (
                        "Select Agent..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 bg-navy-light border-white/10 text-white">
                <Command className="bg-transparent">
                    <CommandInput placeholder="Search agent..." className="text-white" />
                    <CommandEmpty>No agent found.</CommandEmpty>
                    <CommandGroup>
                        {agents.map((agent) => (
                            <CommandItem
                                key={agent.id}
                                value={agent.id}
                                onSelect={(currentValue) => {
                                    onChange(currentValue === value ? "" : currentValue);
                                    setOpen(false);
                                }}
                                className="text-white hover:bg-white/10 cursor-pointer"
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === agent.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                                        {agent.fullName.charAt(0)}
                                    </div>
                                    {agent.fullName}
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
};
