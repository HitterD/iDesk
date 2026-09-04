import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    Mail,
    X,
    Search,
    Check,
    Loader2,
    Plus,
    Calendar,
    Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useActiveUsersForParticipants, type ActiveParticipantUser } from '../hooks';

export type ActiveUser = ActiveParticipantUser;

export interface ZoomParticipantPickerProps {
    value: string[];
    onChange: (emails: string[]) => void;
    disabled?: boolean;
    placeholder?: string;
    id?: string;
}

export const ZoomParticipantPicker: React.FC<ZoomParticipantPickerProps> = ({
    value = [],
    onChange,
    disabled = false,
    placeholder = 'Cari nama/email rekan iDesk atau ketik email eksternal...',
    id = 'zoom-participant-picker',
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch active users from approvers endpoint (accessible to all authenticated users)
    const { data: users = [], isLoading } = useActiveUsersForParticipants();

    // Create lookup map by lowercase email for fast badge resolution
    const usersByEmail = useMemo(() => {
        const map = new Map<string, ActiveUser>();
        users.forEach((u) => {
            if (u.email) {
                map.set(u.email.toLowerCase().trim(), u);
            }
        });
        return map;
    }, [users]);

    // Filter users based on input query
    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) {
            return users.slice(0, 25);
        }
        const q = searchQuery.toLowerCase().trim();
        return users
            .filter(
                (u) =>
                    u.fullName?.toLowerCase().includes(q) ||
                    u.email?.toLowerCase().includes(q) ||
                    u.department?.name?.toLowerCase().includes(q)
            )
            .slice(0, 25);
    }, [users, searchQuery]);

    const isValidEmailQuery = useMemo(() => {
        const trimmed = searchQuery.trim();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    }, [searchQuery]);

    const isAlreadySelectedQuery = useMemo(() => {
        const trimmed = searchQuery.trim().toLowerCase();
        return value.some((email) => email.toLowerCase() === trimmed);
    }, [searchQuery, value]);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectUser = (email: string) => {
        const normalized = email.trim();
        if (!normalized) return;
        if (value.some((e) => e.toLowerCase() === normalized.toLowerCase())) {
            onChange(value.filter((e) => e.toLowerCase() !== normalized.toLowerCase()));
        } else {
            onChange([...value, normalized]);
        }
        setSearchQuery('');
        inputRef.current?.focus();
    };

    const handleAddCustomEmail = (customEmail: string) => {
        const trimmed = customEmail.trim();
        if (!trimmed || !trimmed.includes('@')) return;
        if (!value.some((e) => e.toLowerCase() === trimmed.toLowerCase())) {
            onChange([...value, trimmed]);
        }
        setSearchQuery('');
        inputRef.current?.focus();
    };

    const handleRemoveEmail = (emailToRemove: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        onChange(value.filter((e) => e.toLowerCase() !== emailToRemove.toLowerCase()));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !searchQuery && value.length > 0) {
            e.preventDefault();
            onChange(value.slice(0, -1));
        } else if ((e.key === 'Enter' || e.key === ',') && searchQuery.trim()) {
            e.preventDefault();
            if (isValidEmailQuery) {
                handleAddCustomEmail(searchQuery);
            } else if (filteredUsers.length > 0) {
                handleSelectUser(filteredUsers[0].email);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div className="space-y-1.5" ref={containerRef}>
            {/* Multi-Tag Combobox Container */}
            <div
                onClick={() => {
                    if (!disabled) {
                        inputRef.current?.focus();
                        setIsOpen(true);
                    }
                }}
                className={cn(
                    "relative flex flex-wrap items-center gap-1.5 min-h-[42px] p-1.5 rounded-xl border transition-all cursor-text",
                    isOpen
                        ? "border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600",
                    disabled && "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-950"
                )}
            >
                {/* Render Selected Participant Badges */}
                {value.map((email) => {
                    const user = usersByEmail.get(email.toLowerCase().trim());

                    if (user) {
                        return (
                            <div
                                key={email}
                                data-testid={`participant-chip-${email}`}
                                className="group inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 transition-all hover:bg-slate-200/70 dark:hover:bg-slate-700/80"
                            >
                                <UserAvatar
                                    user={{
                                        id: user.id,
                                        fullName: user.fullName,
                                        avatarUrl: user.avatarUrl,
                                    }}
                                    size="xs"
                                    className="h-4.5 w-4.5 text-[9px] shrink-0"
                                />
                                <span className="max-w-[200px] truncate text-slate-900 dark:text-slate-100 font-semibold" title={`${user.fullName} (${user.email}${user.department?.name ? ` - ${user.department.name}` : ''})`}>
                                    {user.fullName}
                                </span>
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleRemoveEmail(email, e)}
                                        className="h-3.5 w-3.5 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                        aria-label={`Hapus ${user.fullName}`}
                                    >
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                )}
                            </div>
                        );
                    }

                    // External email chip
                    return (
                        <div
                            key={email}
                            data-testid={`participant-chip-${email}`}
                            className="group inline-flex items-center gap-1.5 pl-1.5 pr-1.5 py-0.5 rounded-lg bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 text-xs font-medium text-blue-900 dark:text-blue-200 transition-all hover:bg-blue-100/80 dark:hover:bg-blue-900/60"
                        >
                            <Mail className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span className="max-w-[200px] truncate font-medium" title={email}>
                                {email}
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100/80 dark:bg-blue-900/60 px-1 py-0.2 rounded">
                                Eksternal
                            </span>
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={(e) => handleRemoveEmail(email, e)}
                                    className="h-3.5 w-3.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 flex items-center justify-center text-blue-500 hover:text-blue-800 dark:hover:text-blue-100 transition-colors"
                                    aria-label={`Hapus ${email}`}
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* Inline Search Input */}
                <div className="flex-1 flex items-center min-w-[140px]">
                    <input
                        ref={inputRef}
                        id={id}
                        type="text"
                        disabled={disabled}
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={handleKeyDown}
                        placeholder={value.length === 0 ? placeholder : 'Tambah lagi...'}
                        className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground font-medium py-1 px-1 text-slate-900 dark:text-slate-100"
                        autoComplete="off"
                    />
                </div>
            </div>

            {/* Dropdown Popover */}
            {isOpen && !disabled && (
                <div
                    data-testid="participant-popover"
                    className="absolute z-50 mt-1 left-0 right-0 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl p-1.5 space-y-1 animate-in fade-in-50 zoom-in-95 duration-100"
                >
                    {/* Add external email action button if query is a valid email */}
                    {isValidEmailQuery && !isAlreadySelectedQuery && (
                        <button
                            type="button"
                            data-testid="add-external-email-btn"
                            onClick={() => handleAddCustomEmail(searchQuery)}
                            className="w-full text-left px-2.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-between text-xs text-blue-950 dark:text-blue-200 font-medium transition-colors"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <div className="truncate">
                                    <span>Tambahkan peserta eksternal: </span>
                                    <span className="font-bold underline">{searchQuery.trim()}</span>
                                </div>
                            </div>
                            <kbd className="text-[10px] bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono shrink-0">
                                Enter ↵
                            </kbd>
                        </button>
                    )}

                    {/* Users List Header / Counter */}
                    <div className="flex items-center justify-between px-2 pt-1 pb-0.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <span className="flex items-center gap-1.5">
                            <Users className="h-3 w-3" />
                            <span>Pengguna iDesk ({filteredUsers.length})</span>
                        </span>
                        {isLoading && (
                            <span className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Memuat...
                            </span>
                        )}
                    </div>

                    {/* Users Scrollable List */}
                    <div className="max-h-56 overflow-y-auto space-y-0.5 overscroll-contain pr-1">
                        {filteredUsers.map((user) => {
                            const isSelected = value.some(
                                (e) => e.toLowerCase() === user.email.toLowerCase()
                            );
                            return (
                                <button
                                    key={user.id}
                                    type="button"
                                    data-testid={`user-option-${user.id}`}
                                    onClick={() => handleSelectUser(user.email)}
                                    className={cn(
                                        "w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between gap-2.5 text-xs transition-colors group cursor-pointer",
                                        isSelected
                                            ? "bg-blue-50/70 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200"
                                            : "hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200"
                                    )}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <UserAvatar
                                            user={{
                                                id: user.id,
                                                fullName: user.fullName,
                                                avatarUrl: user.avatarUrl,
                                            }}
                                            size="sm"
                                            className="h-7 w-7 text-[10px] shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                            {/* Baris 1: Nama Lengkap Leluasa */}
                                            <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate" title={user.fullName}>
                                                {user.fullName}
                                            </div>
                                            {/* Baris 2: Email • Departemen */}
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0 mt-0.5">
                                                <span className="truncate shrink-0 max-w-[170px]" title={user.email}>
                                                    {user.email}
                                                </span>
                                                {user.department?.name && (
                                                    <>
                                                        <span className="shrink-0 text-slate-300 dark:text-slate-600 font-bold">•</span>
                                                        <span
                                                            className="truncate text-[10px] bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-normal"
                                                            title={user.department.name}
                                                        >
                                                            {user.department.name}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {isSelected ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                                            <Check className="h-3.5 w-3.5" />
                                            <span>Terpilih</span>
                                        </span>
                                    ) : (
                                        <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                                    )}
                                </button>
                            );
                        })}

                        {filteredUsers.length === 0 && !isValidEmailQuery && (
                            <div className="py-5 text-center text-xs text-muted-foreground space-y-1">
                                <Search className="h-5 w-5 mx-auto text-muted-foreground/60" />
                                <p className="font-medium">Tidak ada pengguna yang cocok dengan "{searchQuery}"</p>
                                <p className="text-[11px]">Ketik alamat email lengkap (misal: user@gmail.com) untuk peserta eksternal.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Helper Text with Calendar & Email Indicator */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-0.5">
                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Peserta akan otomatis menerima rincian meeting & undangan kalender (.ics) via email.</span>
            </div>
        </div>
    );
};
