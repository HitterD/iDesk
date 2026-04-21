import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, User, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../lib/api';
import { cn } from '@/lib/utils';

interface UserOption {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
}

interface UserApiResponse {
    data: UserOption[];
    meta?: {
        total: number;
        page: number;
        limit: number;
    };
}

interface AuditUserFilterProps {
    value?: string;
    onChange: (userId: string | undefined) => void;
    placeholder?: string;
}

export function AuditUserFilter({ value, onChange, placeholder = 'Filter by user...' }: AuditUserFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch users for filter
    const { data: users = [], isError, isLoading } = useQuery<UserOption[]>({
        queryKey: ['users-for-filter'],
        queryFn: async () => {
            try {
                const response = await api.get<UserApiResponse | UserOption[]>('/users', {
                    params: { limit: 100 }
                });
                const userData = Array.isArray(response.data)
                    ? response.data
                    : response.data.data || [];
                return userData.map((u: UserOption) => ({
                    id: u.id,
                    fullName: u.fullName || 'Unknown User',
                    email: u.email || '',
                    avatarUrl: u.avatarUrl,
                }));
            } catch (error) {
                console.error('Failed to fetch users for filter:', error);
                return [];
            }
        },
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });

    useEffect(() => {
        if (value && users.length > 0 && !selectedUser) {
            const found = users.find(u => u.id === value);
            if (found) setSelectedUser(found);
        }
    }, [value, users, selectedUser]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredUsers = users.filter(u =>
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (user: UserOption) => {
        setSelectedUser(user);
        onChange(user.id);
        setIsOpen(false);
        setSearchQuery('');
    };

    const handleClear = () => {
        setSelectedUser(null);
        onChange(undefined);
        setSearchQuery('');
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Input Button */}
            <div
                onClick={() => setIsOpen(true)}
                className={`
                    flex items-center gap-2 px-3 py-2 min-w-[200px]
                    bg-slate-50 dark:bg-slate-800/50 
                    border border-[hsl(var(--border))] 
                    rounded-lg cursor-pointer
                    hover:border-primary/40 transition-colors
                    ${isOpen ? 'ring-2 ring-primary/20 border-primary/40' : ''}
                `}
            >
                <User className="w-3.5 h-3.5 text-slate-400" />
                {selectedUser ? (
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                            {selectedUser.fullName}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClear();
                            }}
                            className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded transition-colors ml-auto flex-shrink-0"
                        >
                            <X className="w-3 h-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                        </button>
                    </div>
                ) : (
                    <span className="flex-1 text-xs font-medium text-slate-400 truncate">{placeholder}</span>
                )}
            </div>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 w-72 max-h-80 overflow-hidden rounded-xl bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg z-[100]"
                    >
                        {/* Search Input */}
                        <div className="p-2 border-b border-[hsl(var(--border))]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search users..."
                                    autoFocus
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-[hsl(var(--border))] rounded-lg text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors duration-150"
                                />
                            </div>
                        </div>

                        {/* User List */}
                        <div className="overflow-y-auto max-h-60 p-1">
                            {isLoading ? (
                                <div className="py-8 text-center text-xs font-medium text-slate-500">
                                    Loading users...
                                </div>
                            ) : isError ? (
                                <div className="py-8 text-center text-xs font-medium text-[hsl(var(--error-500))] flex flex-col items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    Failed to load users
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="py-8 text-center text-xs font-medium text-slate-500">
                                    No users found
                                </div>
                            ) : (
                                filteredUsers.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleSelect(user)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                                            user.id === selectedUser?.id
                                                ? "bg-[hsl(var(--primary))]/10 text-primary"
                                                : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                        )}
                                    >
                                        {/* Avatar placeholder - token based */}
                                        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                                            {user.fullName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold truncate">{user.fullName}</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{user.email}</p>
                                        </div>
                                        {user.id === selectedUser?.id && (
                                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
