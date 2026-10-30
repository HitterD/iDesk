import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import api from '@/lib/api';

export const DEFAULT_DEPARTMENTS = [
  'Information Technology',
  'Human Resources',
  'Finance & Accounting',
  'Sales & Marketing',
  'Operations',
  'General Affairs',
  'Supply Chain & Logistics',
  'Production',
  'Quality Assurance',
  'Purchasing',
];

interface DepartmentItem {
  id?: string;
  name: string;
  code?: string;
}

interface DepartmentSelectorProps {
  value: string;
  onChange: (deptName: string) => void;
  disabled?: boolean;
}

export const DepartmentSelector: React.FC<DepartmentSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: remoteDepartments = [], isLoading } = useQuery<DepartmentItem[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      try {
        const res = await api.get('/departments');
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60_000,
  });

  const departmentList = useMemo(() => {
    const map = new Map<string, string>();

    // Add standard departments
    DEFAULT_DEPARTMENTS.forEach(name => {
      map.set(name.toLowerCase(), name);
    });

    // Add remote departments from master
    remoteDepartments.forEach(dept => {
      if (dept.name?.trim()) {
        map.set(dept.name.trim().toLowerCase(), dept.name.trim());
      }
    });

    // Include current value if present
    if (value && value.trim()) {
      map.set(value.trim().toLowerCase(), value.trim());
    }

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [remoteDepartments, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return departmentList;
    return departmentList.filter(name => name.toLowerCase().includes(q));
  }, [departmentList, search]);

  const isExactMatch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return departmentList.some(name => name.toLowerCase() === q);
  }, [departmentList, search]);

  const handleSelect = (deptName: string) => {
    onChange(deptName);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={value ? `Departemen: ${value}` : 'Pilih departemen'}
            disabled={disabled}
            className={cn(
              'h-10 w-full justify-between rounded-xl px-3 text-left font-normal bg-background hover:bg-muted/40 transition-colors border-input',
              !value && 'text-muted-foreground',
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className={cn('truncate text-sm font-medium', value ? 'text-foreground' : 'text-muted-foreground')}>
                {value || 'Pilih departemen…'}
              </span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-2 rounded-2xl border-border/80 shadow-lg bg-popover text-popover-foreground">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari atau ketik nama departemen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 pl-8 text-xs rounded-xl"
              autoFocus
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1">
            {isLoading && (
              <div className="p-2 text-center text-xs text-muted-foreground animate-pulse">
                Memuat data departemen…
              </div>
            )}

            {filtered.map(dept => {
              const isSelected = value.toLowerCase() === dept.toLowerCase();
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => handleSelect(dept)}
                  className={cn(
                    'flex w-full items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-colors cursor-pointer text-left',
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted/60 text-foreground',
                  )}
                >
                  <span className="truncate">{dept}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1.5" />}
                </button>
              );
            })}

            {search.trim() && !isExactMatch && (
              <button
                type="button"
                onClick={() => handleSelect(search.trim())}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-xs rounded-lg text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-dashed border-primary/30 mt-1 font-medium"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Gunakan &quot;{search.trim()}&quot;</span>
              </button>
            )}

            {!isLoading && filtered.length === 0 && !search.trim() && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Tidak ada data departemen.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
