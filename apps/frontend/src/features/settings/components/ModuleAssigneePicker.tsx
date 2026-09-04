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
  ADMIN: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800',
  AGENT_ORACLE: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800',
  AGENT_WEB_DEV: 'bg-sky-500/10 text-sky-600 border-sky-200 dark:border-sky-800',
  AGENT_MOBILE_DEV: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
  AGENT_OPERATIONAL_SUPPORT: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800',
  AGENT: 'bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800',
  AGENT_ADMIN: 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800',
  MANAGER: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
};

const SITE_COLORS: Record<string, string> = {
  SPJ: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  SMG: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  KRW: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  JTB: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
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
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Search header */}
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 px-3 py-2 bg-slate-50/60 dark:bg-slate-800/40">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full pl-8 pr-8 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={selectAllVisible}
          disabled={disabled || filtered.length === 0}
          className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          Pilih tampilan
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={disabled || selectedIds.length === 0}
          className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          Bersihkan
        </button>
        <div className="text-[11px] text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          {selectedIds.length} dipilih
        </div>
      </div>

      {/* List */}
      <div className="max-h-64 overflow-auto p-1.5">
        {isLoading ? (
          <div className="p-4 text-sm text-slate-500">Memuat daftar agent…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-slate-500 flex items-center gap-2">
            <Users className="w-4 h-4" /> Tidak ada agent yang cocok.
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((agent) => {
              const checked = selectedSet.has(agent.id);
              const roleColor = ROLE_COLORS[agent.role] || 'bg-slate-500/10 text-slate-600 border-slate-200';
              const siteColor = (agent.site?.code && SITE_COLORS[agent.site.code]) || 'bg-slate-500/10 text-slate-600 border-slate-200';
              return (
                <label
                  key={agent.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                    checked
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(agent.id)}
                    disabled={disabled}
                    className="accent-emerald-600 w-4 h-4"
                  />
                  <div className="w-8 h-8 rounded-full bg-slate-900/5 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {agent.fullName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">
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
                    <div className="text-[11px] text-slate-500 truncate">{agent.email}</div>
                  </div>
                  {checked && <Check className="w-4 h-4 text-emerald-600" />}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] text-slate-500">
          Daftar ini akan membatasi siapa saja yang boleh di-assign (manual & auto). Kosongkan untuk kembali ke role.
        </div>
      )}
    </div>
  );
};
