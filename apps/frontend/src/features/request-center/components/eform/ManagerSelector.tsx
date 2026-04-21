import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import api from '@/lib/api';

interface Manager {
  id: string;
  fullName: string;
  jobTitle: string;
  department?: {
    name: string;
  };
}

interface ManagerSelectorProps {
  onSelect: (managerId: string) => void;
  selectedId?: string;
}

export const ManagerSelector: React.FC<ManagerSelectorProps> = ({ onSelect, selectedId }) => {
  const [open, setOpen] = useState(false);

  // Fetch managers from the new approvers API using the configured api instance
  const { data: managers = [], isLoading } = useQuery<Manager[]>({
    queryKey: ['users', 'approvers'],
    queryFn: async () => {
      const { data } = await api.get('/users/approvers');
      return data;
    },
  });

  const selectedManager = managers.find((m) => m.id === selectedId);

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60 flex items-center gap-2">
        <User size={12} className="text-primary" />
        Pilih Atasan Persetujuan
      </label>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between rounded-xl border-border/50 h-11 px-4 hover:border-primary/30 transition-colors duration-150 "
          >
            {selectedManager ? (
              <div className="flex flex-col items-start overflow-hidden">
                <span className="text-sm font-bold truncate w-full text-left">
                  {selectedManager.fullName}
                </span>
                <span className="text-[10px] opacity-60 truncate w-full text-left font-medium">
                  {selectedManager.jobTitle} {selectedManager.department?.name ? `• ${selectedManager.department.name}` : ''}
                </span>
              </div>
            ) : (
              <span className="text-sm opacity-60">Pilih atasan...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl border-border/40 shadow-2xl">
          <Command className="rounded-2xl">
            <CommandInput placeholder="Cari nama atau jabatan..." className="h-11" />
            <CommandList>
              <CommandEmpty>Atasan tidak ditemukan.</CommandEmpty>
              <CommandGroup>
                {managers.map((manager) => (
                  <CommandItem
                    key={manager.id}
                    value={`${manager.fullName} ${manager.id}`.toLowerCase()}
                    onSelect={() => {
                      onSelect(manager.id);
                      setOpen(false);
                    }}
                    onPointerDown={(e) => {
                      // Forced selection for touch/click reliability
                      onSelect(manager.id);
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl m-1 cursor-pointer hover:bg-primary/10 transition-colors pointer-events-auto"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary shrink-0">
                      <User size={16} />
                    </div>
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="text-sm font-bold">{manager.fullName}</span>
                      <span className="text-[10px] opacity-60 font-medium">
                        {manager.jobTitle} {manager.department?.name ? `• ${manager.department.name}` : ''}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4 text-primary",
                        selectedId === manager.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
