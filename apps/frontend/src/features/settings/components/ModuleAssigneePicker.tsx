import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Check, Users } from 'lucide-react';
import api from '@/lib/api';

export interface AgentOption {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
  site?: { code?: string; name?: string };
}

interface ModuleAssigneePickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-bad/10 text-bad-ink border-bad/30',
  AGENT_ORACLE: 'bg-brand/10 text-brand border-brand/30',
  AGENT_WEB_DEV: 'bg-brand/10 text-brand border-brand/30',
  AGENT_MOBILE_DEV: 'bg-ok/10 text-ok-ink border-ok/30',
  AGENT_OPERATIONAL_SUPPORT: 'bg-brand/10 text-brand border-brand/30',
  AGENT: 'bg-aqua/10 text-aqua-ink border-aqua/30',
  AGENT_ADMIN: 'bg-brand/10 text-brand border-brand/30',
  MANAGER: 'bg-warn/10 text-warn-ink border-warn/30',
};

const SITE_COLORS: Record<string, string> = {
  SPJ: 'bg-brand/10 text-brand border-brand/20',
  SMG: 'bg-ok/10 text-ok-ink border-ok/20',
  KRW: 'bg-warn/10 text-warn-ink border-warn/20',
  JTB: 'bg-brand/10 text-brand border-brand/20',
};

export const ModuleAssigneePicker: React.FC<ModuleAssigneePickerProps> = ({
  selectedIds,
  onChange,
  disabled,
  placeholder = 'Cari agent…',
}) => {
  const [query, setQuery] = useState('');

  const { data: agents = [], isLoading } = useQuery<AgentOption[]>({
    queryKey: ['agents', 'all'],
    queryFn: async () => {
      const res = await api.get('/users/agents');
      return res.data;
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
      a.fullName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.site?.code && a.site.code.toLowerCase().includes(q))
    );
  }, [agents, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(Array.from(next));
  };

  const clearAll = () => {
    if (!disabled) onChange([]);
  };

  const selectAllVisible = () => {
    if (disabled) return;
    const visibleIds = filtered.map((a) => a.id);
    const next = new Set(selectedSet);
    visibleIds.forEach((id) => next.add(id));
    onChange(Array.from(next));
  };

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden">
      {/* Search header */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 bg-fill">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full pl-8 pr-8 py-1.5 text-sm rounded-xl border border-line bg-surface text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-ink-3 hover:text-ink-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={selectAllVisible}
          disabled={disabled || filtered.length === 0}
          className="idesk-btn is-soft"
        >
          Pilih tampilan
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={disabled || selectedIds.length === 0}
          className="idesk-btn is-soft"
        >
          Bersihkan
        </button>
        <div className="text-[11px] text-ink-2 px-1.5 py-0.5 rounded bg-fill border border-line">
          {selectedIds.length} dipilih
        </div>
      </div>

      {/* List */}
      <div className="max-h-64 overflow-auto p-1.5">
        {isLoading ? (
          <div className="p-4 text-sm text-ink-2">Memuat daftar agent…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-ink-2 flex items-center gap-2">
            <Users className="w-4 h-4" /> Tidak ada agent yang cocok.
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((agent) => {
              const checked = selectedSet.has(agent.id);
              const roleColor = ROLE_COLORS[agent.role] || 'bg-ink-3/10 text-ink-2 border-line';
              const siteColor = (agent.site?.code && SITE_COLORS[agent.site.code]) || 'bg-ink-3/10 text-ink-2 border-line';
              return (
                <label
                  key={agent.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                    checked
                      ? 'bg-ok/10 border-ok/30'
                      : 'bg-surface border-line hover:bg-fill'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(agent.id)}
                    disabled={disabled}
                    className="accent-ok w-4 h-4"
                  />
                  <div className="w-8 h-8 rounded-full bg-code/5 flex items-center justify-center text-xs font-bold text-ink-2 flex-shrink-0">
                    {agent.fullName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink truncate">
                        {agent.fullName}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${roleColor}`}>
                        {agent.role.replace('AGENT_', '').replace('_', ' ')}
                      </span>
                      {agent.site?.code && (
                        <span className={`text-[10px] px-1 py-0.5 rounded border font-mono ${siteColor}`}>
                          {agent.site.code}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-2 truncate">{agent.email}</div>
                  </div>
                  {checked && <Check className="w-4 h-4 text-ok-ink" />}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="px-3 py-2 border-t border-line bg-fill text-[11px] text-ink-2">
          Daftar ini akan membatasi siapa saja yang boleh di-assign (manual & auto). Kosongkan untuk kembali ke role.
        </div>
      )}
    </div>
  );
};
