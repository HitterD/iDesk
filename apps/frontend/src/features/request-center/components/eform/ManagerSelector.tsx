import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  currentUserId?: string;
}

export const ManagerSelector: React.FC<ManagerSelectorProps> = ({
  onSelect,
  selectedId,
  currentUserId,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: managers = [], isLoading } = useQuery<Manager[]>({
    queryKey: ['users', 'approvers', currentUserId],
    queryFn: async () => {
      const url = currentUserId
        ? `/users/approvers?exclude=${currentUserId}`
        : '/users/approvers';
      const { data } = await api.get(url);
      return Array.isArray(data) ? data : [];
    },
  });

  const filtered = useMemo(
    () =>
      managers.filter(m =>
        `${m.fullName} ${m.jobTitle ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [managers, search],
  );

  const selectedManager = managers.find(m => m.id === selectedId);

  return (
    <div className="space-y-2">
      <span id="manager-selector-label" className="block text-sm font-semibold text-foreground">
        Atasan yang menyetujui <span className="text-destructive">*</span>
      </span>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-labelledby="manager-selector-label"
            className="h-auto min-h-11 w-full justify-between rounded-xl px-4 py-2 transition-colors hover:border-primary/30"
          >
            {selectedManager ? (
              <span className="flex flex-col items-start overflow-hidden">
                <span className="w-full truncate text-left text-sm font-bold text-foreground">
                  {selectedManager.fullName}
                </span>
                <span className="w-full truncate text-left text-xs text-muted-foreground">
                  {selectedManager.jobTitle}
                  {selectedManager.department?.name
                    ? ` • ${selectedManager.department.name}`
                    : ''}
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Pilih atasan…</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] rounded-xl border-border p-2 shadow-lg">
          <Input
            placeholder="Cari nama atau jabatan…"
            aria-label="Cari atasan"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mb-2 h-9 rounded-xl"
            autoFocus
          />

          <div className="max-h-60 overflow-y-auto">
            {isLoading && (
              <div className="space-y-1 p-1">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {search ? 'Tidak ada atasan yang cocok.' : 'Belum ada atasan terdaftar.'}
              </p>
            )}
            {filtered.map(manager => (
              <button
                key={manager.id}
                type="button"
                onClick={() => {
                  onSelect(manager.id);
                  setOpen(false);
                  setSearch('');
                }}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User size={16} aria-hidden="true" />
                </span>
                <span className="flex flex-1 flex-col overflow-hidden">
                  <span className="truncate text-sm font-bold text-foreground">{manager.fullName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {manager.jobTitle}
                    {manager.department?.name
                      ? ` • ${manager.department.name}`
                      : ''}
                  </span>
                </span>
                <Check
                  className={cn(
                    'ml-auto h-4 w-4 text-primary',
                    selectedId === manager.id ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};