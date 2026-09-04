import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Check, X, Search, Shield, Wrench, User } from 'lucide-react';
import { fetchTechnicians, type TechnicianItem } from '../../api/installation.api';
import { cn } from '@/lib/utils';

type Props = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  mode?: 'single' | 'multiple';
  title?: string;
  siteId?: string;
};

const formatRoleLabel = (role?: string) => {
  if (!role) return '';
  switch (role) {
    case 'AGENT_OPERATIONAL_SUPPORT':
      return 'Ops Support';
    case 'AGENT_ADMIN':
      return 'Agent Admin';
    case 'AGENT_ORACLE':
      return 'Agent Oracle';
    case 'AGENT':
      return 'Agent';
    case 'ADMIN':
      return 'Admin';
    case 'MANAGER':
      return 'Manager';
    default:
      return role;
  }
};

export function TechnicianFilter({
  selectedIds,
  onChange,
  mode = 'multiple',
  title = 'Filter Teknisi',
  siteId,
}: Props) {
  const [search, setSearch] = useState('');
  const { data: technicians = [], isLoading } = useQuery<TechnicianItem[]>({
    queryKey: ['hardware-requests', 'technicians', siteId],
    queryFn: () => fetchTechnicians(siteId),
    staleTime: 5 * 60_000,
  });

  const toggle = (id: string) => {
    if (mode === 'single') {
      onChange(selectedIds.includes(id) ? [] : [id]);
    } else {
      onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
    }
  };

  const clearAll = () => onChange([]);

  const filtered = technicians.filter((t: TechnicianItem) =>
    (t.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.role || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-card rounded-2xl border border-border p-3.5 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Users className="size-3.5 text-primary" />
          <span>{title}</span>
          {selectedIds.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-primary text-primary-foreground">
              {selectedIds.length}
            </span>
          )}
        </div>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-0.5"
          >
            <X className="size-3" />
            Reset
          </button>
        )}
      </div>

      {(technicians.length > 3 || search.length > 0) && (
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau role agent..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-muted/40 border border-border/70 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/60"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-0.5 custom-scrollbar">
        {isLoading ? (
          <div className="flex gap-1.5 w-full">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-28 bg-muted/60 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-1">Tidak ada teknisi atau agent ditemukan.</p>
        ) : (
          filtered.map((t: TechnicianItem) => {
            const active = selectedIds.includes(t.id);
            const initials = t.fullName
              .split(' ')
              .filter(Boolean)
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase() || 'TK';

            const roleLabel = formatRoleLabel(t.role);

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer shadow-2xs active:scale-[0.98]',
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/40'
                    : 'bg-card text-foreground hover:bg-muted/60 border-border/80'
                )}
              >
                <span
                  className={cn(
                    'size-5 rounded-full flex items-center justify-center text-[9px] font-bold font-mono shrink-0',
                    active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
                  )}
                >
                  {active ? <Check className="size-3" /> : initials}
                </span>
                <span className="truncate max-w-[150px]">{t.fullName}</span>
                {roleLabel && (
                  <span
                    className={cn(
                      'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded',
                      active
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {roleLabel}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}