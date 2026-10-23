import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Zap, Search, Plus, Edit2, Trash2, Folder, X, Sparkles, MessageSquare, Clock, CheckCircle2, HelpCircle, CornerDownLeft, RotateCcw, Tag, Hash, User, ShieldCheck, Check, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useSavedReplies,
  useCreateSavedReply,
  useUpdateSavedReply,
  useDeleteSavedReply,
  useResetSavedReplies,
  SavedReply,
} from '@/features/ticket-board/hooks/useSavedReplies';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type { SavedReply } from '@/features/ticket-board/hooks/useSavedReplies';

export interface TicketVariables {
  user_name?: string;
  agent_name?: string;
  ticket_id?: string;
  category?: string;
  [key: string]: string | undefined;
}

/**
 * Replaces dynamic placeholders like {user_name}, {agent_name}, {ticket_id} with actual data
 */
export function applyPlaceholders(content: string, variables?: TicketVariables): string {
  if (!content) return '';
  let result = content;
  const vars: Record<string, string> = {
    user_name: variables?.user_name || 'Customer',
    agent_name: variables?.agent_name || 'Agent',
    ticket_id: variables?.ticket_id ? `${variables.ticket_id}` : '',
    category: variables?.category || '',
    ...variables,
  };

  Object.entries(vars).forEach(([key, val]) => {
    if (val !== undefined) {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      result = result.replace(regex, val);
    }
  });

  return result;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; badgeClass: string; activeBadgeClass: string; textClass: string }> = {
  All: {
    label: 'Semua',
    icon: Sparkles,
    badgeClass: 'bg-muted text-muted-foreground hover:bg-muted/80',
    activeBadgeClass: 'bg-brand text-white font-semibold shadow-xs',
    textClass: 'text-muted-foreground',
  },
  General: {
    label: 'General',
    icon: MessageSquare,
    badgeClass: 'bg-brand/10 text-brand border-brand/20 hover:bg-brand/15',
    activeBadgeClass: 'bg-brand text-white font-semibold shadow-xs',
    textClass: 'text-brand',
  },
  'Status Update': {
    label: 'Status Update',
    icon: Clock,
    badgeClass: 'bg-warn/10 text-warn-ink border-warn/20 hover:bg-warn/15',
    activeBadgeClass: 'bg-warn text-white font-semibold shadow-xs',
    textClass: 'text-warn-ink',
  },
  Closing: {
    label: 'Closing',
    icon: CheckCircle2,
    badgeClass: 'bg-ok/10 text-ok-ink border-ok/20 hover:bg-ok/15',
    activeBadgeClass: 'bg-ok text-white font-semibold shadow-xs',
    textClass: 'text-ok-ink',
  },
  'How To': {
    label: 'How To',
    icon: HelpCircle,
    badgeClass: 'bg-brand/10 text-brand border-brand/20 hover:bg-brand/15',
    activeBadgeClass: 'bg-brand text-white font-semibold shadow-xs',
    textClass: 'text-brand',
  },
};

const DYNAMIC_TAGS = [
  { tag: '{user_name}', label: 'Nama Pelapor', icon: User, desc: 'Nama lengkap customer / requester' },
  { tag: '{agent_name}', label: 'Nama Agent', icon: ShieldCheck, desc: 'Nama Anda sebagai agent yang merespons' },
  { tag: '{ticket_id}', label: 'Nomor Tiket', icon: Hash, desc: 'Nomor ID tiket saat ini (cth: #270826-IT)' },
];

/* ──────────────────────────────────────────────────────────────────────────
   1. SlashCommandAutocomplete Component
   Floating menu appearing directly above chat input when user types `/...`
────────────────────────────────────────────────────────────────────────── */

interface SlashCommandAutocompleteProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (reply: SavedReply) => void;
  variables?: TicketVariables;
  className?: string;
}

export const SlashCommandAutocomplete: React.FC<SlashCommandAutocompleteProps> = ({
  query,
  isOpen,
  onClose,
  onSelect,
  variables,
  className,
}) => {
  const { data: responses = [] } = useSavedReplies();
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter responses by shortcut or title
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q || q === '/') return responses;
    const cleanQ = q.startsWith('/') ? q.slice(1) : q;

    return responses.filter((r) => {
      const matchShortcut = r.shortcut?.toLowerCase().includes(cleanQ) || r.shortcut?.toLowerCase().includes(q);
      const matchTitle = r.title.toLowerCase().includes(cleanQ);
      const matchCategory = (r.category || '').toLowerCase().includes(cleanQ);
      return matchShortcut || matchTitle || matchCategory;
    });
  }, [responses, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  useEffect(() => {
    if (isOpen && itemRefs.current[selectedIndex]) {
      const el = itemRefs.current[selectedIndex];
      if (typeof el?.scrollIntoView === 'function') {
        el.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex, isOpen]);

  // Global keydown capture when open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (filtered.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % filtered.length);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (filtered.length > 0) {
          setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        }
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered.length > 0 && filtered[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, filtered, selectedIndex, onSelect, onClose]);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute bottom-full mb-2 left-0 w-[380px] max-w-[calc(100vw-32px)] bg-surface/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-line p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 select-none",
        className
      )}
    >
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-line mb-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-2">
          <Zap className="w-3.5 h-3.5 text-warn animate-pulse" />
          <span>Quick Reply Shortcut</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-ink-3">
          <kbd className="px-1 py-0.2 bg-fill rounded font-mono border border-line">↵ Enter / Tab</kbd>
          <span>Pilih</span>
        </div>
      </div>

      <div ref={listRef} className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar p-1">
        {filtered.map((item, idx) => {
          const isSelected = selectedIndex === idx;
          const meta = CATEGORY_META[item.category || 'General'] || CATEGORY_META.General;
          const previewText = applyPlaceholders(item.content, variables);

          return (
            <button
              key={item.id}
              ref={(el) => { itemRefs.current[idx] = el; }}
              type="button"
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                "w-full flex items-start justify-between gap-2.5 px-3 py-2 text-left rounded-xl transition-all duration-100 cursor-pointer border",
                isSelected
                  ? "bg-brand/10 border-brand/30 text-brand shadow-2xs"
                  : "border-transparent text-ink hover:bg-fill"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {item.shortcut && (
                    <kbd className={cn(
                      "px-1.5 py-0.5 text-[10px] font-mono font-bold rounded border shadow-2xs transition-colors",
                      isSelected
                        ? "bg-brand text-white border-brand"
                        : "bg-fill text-ink border-line"
                    )}>
                      {item.shortcut}
                    </kbd>
                  )}
                  <span className="text-xs font-bold truncate">
                    {item.title}
                  </span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded text-[10px] font-medium border shrink-0",
                    meta.badgeClass
                  )}>
                    {item.category || 'General'}
                  </span>
                </div>
                <p className="text-[11px] text-ink-2 line-clamp-1 leading-normal">
                  {previewText}
                </p>
              </div>

              <div className="shrink-0 pt-1">
                <CornerDownLeft className={cn(
                  "w-3.5 h-3.5 transition-opacity",
                  isSelected ? "opacity-100 text-brand" : "opacity-0"
                )} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   2. CannedResponsePicker Popover (Toolbar Button)
────────────────────────────────────────────────────────────────────────── */

interface CannedResponsePickerProps {
  onSelect: (content: string) => void;
  variables?: TicketVariables;
  className?: string;
  /** Icon-only trigger, for placing the picker inside a composer. */
  compact?: boolean;
}

export const CannedResponsePicker: React.FC<CannedResponsePickerProps> = ({
  onSelect,
  variables,
  className,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { data: responses = [] } = useSavedReplies();

  const categories = useMemo(() => {
    const set = new Set<string>();
    responses.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return ['All', ...Array.from(set)];
  }, [responses]);

  const filteredResponses = useMemo(() => {
    let list = responses;
    if (selectedCategory !== 'All') {
      list = list.filter((r) => r.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          (r.category && r.category.toLowerCase().includes(q)) ||
          (r.shortcut && r.shortcut.toLowerCase().includes(q))
      );
    }
    return list;
  }, [responses, selectedCategory, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResponses]);

  useEffect(() => {
    if (isOpen && itemRefs.current[selectedIndex]) {
      const el = itemRefs.current[selectedIndex];
      if (typeof el?.scrollIntoView === 'function') {
        el.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex, isOpen]);

  const handleSelect = (reply: SavedReply) => {
    const finalContent = applyPlaceholders(reply.content, variables);
    onSelect(finalContent);
    setIsOpen(false);
    setSearch('');
    setSelectedCategory('All');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredResponses.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredResponses.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredResponses.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredResponses.length) % filteredResponses.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResponses[selectedIndex]) {
        handleSelect(filteredResponses[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Buka template quick reply"
            className={cn(
              compact
                ? "inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors cursor-pointer select-none"
                : "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer border select-none",
              compact
                ? (isOpen ? "bg-primary/10 text-primary" : "text-ink-3 hover:text-ink hover:bg-fill")
                : isOpen
                  ? "bg-brand/10 border-brand/30 text-brand shadow-xs"
                  : "border-transparent text-ink-2 hover:text-ink hover:bg-fill",
              className
            )}
            title="Quick reply templates (Ketik / di chat)"
          >
            {compact ? (
              <Zap className="w-[18px] h-[18px]" aria-hidden="true" />
            ) : (
              <>
                <Zap className={cn("w-3.5 h-3.5 transition-colors", isOpen ? "text-brand" : "text-warn")} aria-hidden="true" />
                <span>Quick Reply</span>
                <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-mono font-medium rounded bg-fill text-ink-2 border border-line">
                  /
                </kbd>
              </>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="start"
          sideOffset={10}
          collisionPadding={16}
          className="w-[420px] max-w-[calc(100vw-32px)] p-0 rounded-2xl border border-line bg-surface/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 data-[side=top]:slide-in-from-bottom-2"
          onKeyDown={handleKeyDown}
        >
          {/* Search Header */}
          <div className="p-3 border-b border-line bg-fill">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="relative flex-1 flex items-center">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari template atau ketik /shortcut..."
                  aria-label="Cari template quick reply"
                  className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-surface border border-line rounded-xl outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand placeholder:text-ink-3 text-ink transition-all shadow-2xs"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-3 hover:text-ink-2 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsManageModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 border border-brand/30 rounded-xl transition-colors shrink-0 cursor-pointer"
                title="Kelola & Tambah Template"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Kelola</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {categories.map((cat) => {
                const meta = CATEGORY_META[cat] || {
                  label: cat,
                  icon: Folder,
                  badgeClass: 'bg-fill text-ink-2',
                  activeBadgeClass: 'bg-brand text-white font-semibold',
                };
                const CatIcon = meta.icon;
                const isActive = selectedCategory === cat;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer",
                      isActive ? meta.activeBadgeClass : meta.badgeClass
                    )}
                  >
                    <CatIcon className="w-3 h-3" />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Templates List */}
          <div ref={listRef} className="max-h-72 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredResponses.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-3 space-y-2">
                <Zap className="w-7 h-7 mx-auto text-ink-3" />
                <p className="font-semibold text-ink">Tidak ada template ditemukan</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsManageModalOpen(true);
                  }}
                  className="idesk-btn is-primary"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Buat Template Baru
                </button>
              </div>
            ) : (
              filteredResponses.map((response, idx) => {
                const isSelected = selectedIndex === idx;
                const meta = CATEGORY_META[response.category || 'General'] || CATEGORY_META.General;
                const CatIcon = meta.icon;
                const previewContent = applyPlaceholders(response.content, variables);

                return (
                  <button
                    key={response.id}
                    ref={(el) => { itemRefs.current[idx] = el; }}
                    type="button"
                    onClick={() => handleSelect(response)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "w-full flex items-start justify-between gap-3 p-2.5 text-left rounded-xl transition-all duration-150 group cursor-pointer border",
                      isSelected
                        ? "bg-brand/10 border-brand/30 shadow-2xs"
                        : "border-transparent hover:bg-fill"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-ink truncate group-hover:text-brand transition-colors">
                          {response.title}
                        </span>
                        <span className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-medium border shrink-0",
                          meta.badgeClass
                        )}>
                          <CatIcon className="w-2.5 h-2.5" />
                          {response.category || 'General'}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-2 line-clamp-2 leading-relaxed">
                        {previewContent}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                      {response.shortcut && (
                        <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-fill text-ink rounded border border-line shadow-2xs group-hover:border-brand/40 group-hover:text-brand transition-colors">
                          {response.shortcut}
                        </kbd>
                      )}
                      <CornerDownLeft className={cn(
                        "w-3.5 h-3.5 transition-opacity",
                        isSelected ? "opacity-100 text-brand" : "opacity-0 group-hover:opacity-60 text-ink-3"
                      )} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Shortcut Helper */}
          <div className="px-3 py-2 bg-fill border-t border-line text-[10px] text-ink-3 flex items-center justify-between select-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 bg-surface border border-line rounded font-mono text-[9px]">↑↓</kbd>
                <span>Navigasi</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 bg-surface border border-line rounded font-mono text-[9px]">↵</kbd>
                <span>Pilih</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 bg-surface border border-line rounded font-mono text-[9px]">Esc</kbd>
                <span>Tutup</span>
              </span>
            </div>
            <span className="font-medium text-ink-2 font-mono">
              {filteredResponses.length} template
            </span>
          </div>
        </PopoverContent>
      </Popover>

      {/* Modal Dialog for managing / adding template from chat */}
      <CannedResponseModalDialog
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
      />
    </>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   3. CannedResponseFormDialog (Create / Edit Modal)
────────────────────────────────────────────────────────────────────────── */

interface CannedResponseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: SavedReply | null;
}

export const CannedResponseFormModal: React.FC<CannedResponseFormModalProps> = ({
  isOpen,
  onClose,
  initialData,
}) => {
  const [title, setTitle] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [category, setCategory] = useState('General');
  const [content, setContent] = useState('');
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  const createMutation = useCreateSavedReply();
  const updateMutation = useUpdateSavedReply();

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setShortcut(initialData.shortcut || '');
      setCategory(initialData.category || 'General');
      setContent(initialData.content);
    } else {
      setTitle('');
      setShortcut('');
      setCategory('General');
      setContent('');
    }
  }, [initialData, isOpen]);

  const handleInsertTag = (tag: string) => {
    if (!contentInputRef.current) {
      setContent((prev) => prev + tag);
      return;
    }
    const start = contentInputRef.current.selectionStart;
    const end = contentInputRef.current.selectionEnd;
    const newContent = content.substring(0, start) + tag + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      if (contentInputRef.current) {
        contentInputRef.current.focus();
        contentInputRef.current.setSelectionRange(start + tag.length, start + tag.length);
      }
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Judul dan isi template tidak boleh kosong');
      return;
    }

    let cleanShortcut = shortcut.trim();
    if (cleanShortcut && !cleanShortcut.startsWith('/')) {
      cleanShortcut = `/${cleanShortcut}`;
    }

    try {
      if (initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          payload: {
            title: title.trim(),
            shortcut: cleanShortcut || undefined,
            category: category.trim() || 'General',
            content: content.trim(),
          },
        });
      } else {
        await createMutation.mutateAsync({
          title: title.trim(),
          shortcut: cleanShortcut || undefined,
          category: category.trim() || 'General',
          content: content.trim(),
        });
      }
      onClose();
    } catch {
      // Handled in mutation hook toast
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl p-6 bg-surface rounded-3xl border border-line shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold text-ink flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand" />
            <span>{initialData ? 'Edit Template Quick Reply' : 'Buat Template Quick Reply Baru'}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-2">
            Template ini akan tersimpan khusus untuk profil Anda dan dapat dipanggil dengan shortcut di kotak chat.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Judul Template <span className="text-bad">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="cth: Greeting Pelanggan"
                className="w-full px-3.5 py-2 text-xs bg-fill border border-line rounded-xl outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-ink transition-all shadow-2xs"
                required
              />
            </div>

            {/* Shortcut */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Shortcut Slash <span className="text-ink-3 font-normal">(opsional)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={shortcut}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val && !val.startsWith('/')) val = `/${val}`;
                    setShortcut(val);
                  }}
                  placeholder="/hi"
                  className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-fill border border-line rounded-xl outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-brand transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-bold text-ink mb-1.5">
              Kategori
            </label>
            <div className="flex flex-wrap gap-2">
              {['General', 'Status Update', 'Closing', 'How To'].map((cat) => {
                const meta = CATEGORY_META[cat];
                const CatIcon = meta.icon;
                const isSelected = category === cat;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border",
                      isSelected
                        ? "bg-brand text-white border-brand shadow-xs"
                        : "bg-fill text-ink-2 border-line hover:bg-fill"
                    )}
                  >
                    <CatIcon className="w-3.5 h-3.5" />
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Variable Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-ink flex items-center gap-1">
                <Tag className="w-3 h-3 text-brand" />
                <span>Sisipkan Variabel Otomatis:</span>
              </label>
              <span className="text-[10px] text-ink-3">Klik untuk menyisipkan ke isi pesan</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DYNAMIC_TAGS.map((tagItem) => {
                const Icon = tagItem.icon;
                return (
                  <button
                    key={tagItem.tag}
                    type="button"
                    onClick={() => handleInsertTag(tagItem.tag)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand/10 text-brand hover:bg-brand/15 border border-brand/30 rounded-lg text-[11px] font-mono font-medium transition-colors cursor-pointer group"
                    title={tagItem.desc}
                  >
                    <Icon className="w-3 h-3 text-brand group-hover:scale-110 transition-transform" />
                    <span>{tagItem.tag}</span>
                    <span className="text-[10px] text-brand/80 font-sans ml-0.5 font-normal">({tagItem.label})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-ink">
                Isi Pesan Template <span className="text-bad">*</span>
              </label>
              <span className="text-[11px] text-ink-3 font-mono">
                {content.length} karakter
              </span>
            </div>
            <textarea
              ref={contentInputRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Tulis format balasan template di sini..."
              className="w-full px-3.5 py-2.5 text-xs bg-fill border border-line rounded-2xl outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand text-ink transition-all resize-none shadow-2xs leading-relaxed"
              required
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-ink-2 hover:bg-fill rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim() || !content.trim()}
              className="idesk-btn is-primary disabled:opacity-50"
            >
              {isPending ? (
                <span>Menyimpan...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{initialData ? 'Simpan Perubahan' : 'Buat Template'}</span>
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   4. CannedResponseModalDialog (Popup list manager from chat)
────────────────────────────────────────────────────────────────────────── */

interface CannedResponseModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CannedResponseModalDialog: React.FC<CannedResponseModalDialogProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] p-6 bg-surface rounded-3xl border border-line shadow-2xl overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold text-ink flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand" />
            <span>Kelola Quick Reply Profil Anda</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-2">
            Daftar respons cepat pribadi yang dapat Anda gunakan di ruang chat tiket.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          <CannedResponsesManager />
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   5. CannedResponsesManager Component (Full Page in Settings & Modal)
────────────────────────────────────────────────────────────────────────── */

export const CannedResponsesManager: React.FC = () => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SavedReply | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const { data: responses = [], isLoading } = useSavedReplies();
  const deleteMutation = useDeleteSavedReply();
  const resetMutation = useResetSavedReplies();

  const categories = useMemo(() => {
    const set = new Set<string>();
    responses.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return ['All', ...Array.from(set)];
  }, [responses]);

  const filteredList = useMemo(() => {
    let list = responses;
    if (categoryFilter !== 'All') {
      list = list.filter((r) => r.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          (r.category && r.category.toLowerCase().includes(q)) ||
          (r.shortcut && r.shortcut.toLowerCase().includes(q))
      );
    }
    return list;
  }, [responses, categoryFilter, search]);

  const handleEdit = (reply: SavedReply) => {
    setEditingItem(reply);
    setFormModalOpen(true);
  };

  const handleCreateNew = () => {
    setEditingItem(null);
    setFormModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setDeleteConfirmId(null);
  };

  const handleResetDefaults = async () => {
    await resetMutation.mutateAsync();
    setResetConfirmOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions (mockup settings.html "Quick Reply") */}
      <div className="set-head">
        <div className="min-w-0">
          <h2 className="set-title">Quick Reply</h2>
          <p className="set-sub">
            Balasan siap pakai di composer tiket (ikon petir). Panggil cepat dengan mengetik <code className="font-mono bg-fill px-1 py-0.5 rounded text-brand font-bold">/</code> di obrolan tiket.
          </p>
        </div>

        <div className="set-head-acts">
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            className="idesk-btn is-soft"
            title="Reset ke template default bawaan"
          >
            <RotateCcw className="w-3.5 h-3.5 text-ink-3" />
            <span>Reset Default</span>
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="idesk-btn is-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Template</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari template berdasarkan judul, isi, atau shortcut..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-surface border border-line rounded-xl outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand placeholder:text-ink-3 text-ink transition-all shadow-2xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-3 hover:text-ink-2 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {categories.map((cat) => {
            const meta = CATEGORY_META[cat] || {
              label: cat,
              icon: Folder,
              badgeClass: 'bg-fill text-ink-2',
              activeBadgeClass: 'bg-brand text-white font-semibold',
            };
            const CatIcon = meta.icon;
            const isActive = categoryFilter === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer border",
                  isActive ? meta.activeBadgeClass : meta.badgeClass
                )}
              >
                <CatIcon className="w-3 h-3" />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Templates */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-fill rounded-2xl animate-pulse border border-line" />
          ))}
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-14 text-center bg-surface rounded-3xl border border-line p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto border border-brand/30">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink">Belum Ada Template</h4>
            <p className="text-xs text-ink-2 max-w-sm mx-auto mt-1">
              Buat template balasan instan pribadi Anda agar dapat merespons tiket dengan jauh lebih cepat.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateNew}
            className="idesk-btn is-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Template Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((response) => {
            const meta = CATEGORY_META[response.category || 'General'] || CATEGORY_META.General;
            const CatIcon = meta.icon;

            return (
              <div
                key={response.id}
                className="bg-surface rounded-2xl border border-line p-4 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-ink">
                        {response.title}
                      </h4>
                      {response.shortcut && (
                        <kbd className="px-2 py-0.5 text-xs font-mono font-bold bg-brand/10 text-brand rounded-lg border border-brand/30 shadow-2xs">
                          {response.shortcut}
                        </kbd>
                      )}
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border shrink-0",
                        meta.badgeClass
                      )}>
                        <CatIcon className="w-2.5 h-2.5" />
                        {response.category || 'General'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleEdit(response)}
                        aria-label={`Edit ${response.title}`}
                        className="p-1.5 text-ink-3 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors cursor-pointer"
                        title="Edit Template"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(response.id)}
                        aria-label={`Hapus ${response.title}`}
                        className="p-1.5 text-ink-3 hover:text-bad-ink hover:bg-bad/10 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-ink-2 whitespace-pre-wrap line-clamp-3 leading-relaxed font-normal bg-fill p-2.5 rounded-xl border border-line">
                    {response.content}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-line flex items-center justify-between text-[11px] text-ink-3">
                  <span>Ketik <code className="font-mono font-bold text-brand">{response.shortcut || `/${response.title.toLowerCase().replace(/\s+/g, '')}`}</code></span>
                  <span>Personal Agent</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal (Create / Edit) */}
      <CannedResponseFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingItem(null);
        }}
        initialData={editingItem}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md p-6 bg-surface rounded-3xl border border-line shadow-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold text-ink flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-bad" />
              <span>Hapus Template Quick Reply?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-2">
              Template ini akan dihapus permanen dari profil Anda. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <button
              type="button"
              onClick={() => setDeleteConfirmId(null)}
              className="px-4 py-2 text-xs font-semibold text-ink-2 hover:bg-fill rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              className="idesk-btn is-danger is-solid"
            >
              {deleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus Template'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="sm:max-w-md p-6 bg-surface rounded-3xl border border-line shadow-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold text-ink flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-warn" />
              <span>Reset ke Template Default?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-2">
              Semua template kustom saat ini akan digantikan kembali dengan template bawaan sistem (/hi, /info, /esc, /vendor, /done, /pwd).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <button
              type="button"
              onClick={() => setResetConfirmOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-ink-2 hover:bg-fill rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={resetMutation.isPending}
              className="px-4 py-2 bg-warn hover:bg-warn/90 text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {resetMutation.isPending ? 'Mereset...' : 'Ya, Reset ke Default'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CannedResponsePicker;
