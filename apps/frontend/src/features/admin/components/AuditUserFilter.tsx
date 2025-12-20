import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, User, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../lib/api';

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

    // Fetch users for filter - using existing paginated endpoint
    const { data: users = [], isError, isLoading } = useQuery<UserOption[]>({
        queryKey: ['users-for-filter'],
        queryFn: async () => {
            try {
                // Use the existing paginated users endpoint
                const response = await api.get<UserApiResponse | UserOption[]>('/users', {
                    params: { limit: 100 }
                });
                // Handle both paginated and array responses
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
        staleTime: 5 * 60 * 1000, // Cache for 5 min
        retry: 1,
    });

    // Fetch selected user details if value is set but selectedUser is null
    useEffect(() => {
        if (value && users.length > 0 && !selectedUser) {
            const found = users.find(u => u.id === value);
            if (found) setSelectedUser(found);
        }
    }, [value, users, selectedUser]);

    // Close on outside click
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
            {/* Input */}
            <div
                onClick={() => setIsOpen(true)}
                className={`
                    flex items-center gap-2 px-3 py-2.5 min-w-[200px]
                    bg-slate-50 dark:bg-slate-900 
                    border border-slate-200 dark:border-slate-700 
                    rounded-xl cursor-pointer
                    hover:border-violet-400/50 transition-colors
                    ${isOpen ? 'ring-2 ring-violet-500/30 border-violet-400/50' : ''}
                `}
            >
                <User className="w-4 h-4 text-slate-400" />
                {selectedUser ? (
                    <div className="flex-1 flex items-center gap-2">
                        <span className="text-sm text-slate-800 dark:text-white truncate">
                            {selectedUser.fullName}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClear();
                            }}
                            className="p-0.5 hover:bg-white/20 rounded"
                        >
                            <X className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                    </div>
                ) : (
                    <span className="flex-1 text-sm text-slate-400">{placeholder}</span>
                )}
            </div>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 w-72 max-h-80 overflow-hidden rounded-xl bg-gray-800/95 backdrop-blur-xl border border-white/10 shadow-xl z-[100]"
                    >
                        {/* Search */}
                        <div className="p-2 border-b border-white/5">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search users..."
                                    autoFocus
                                    className="w-full pl-9 pr-3 py-2 bg-white/10 border-0 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                                />
                            </div>
                        </div>

                        {/* Options */}
                        <div className="overflow-y-auto max-h-60 p-1">
                            {isLoading ? (
                                <div className="py-8 text-center text-sm text-white/40">
                                    Loading users...
                                </div>
                            ) : isError ? (
                                <div className="py-8 text-center text-sm text-red-400 flex flex-col items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    Failed to load users
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="py-8 text-center text-sm text-white/40">
                                    No users found
                                </div>
                            ) : (
                                filteredUsers.slice(0, 20).map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleSelect(user)}
                                        className={`
                                            w-full flex items-center gap-3 px-3 py-2 rounded-lg
                                            text-left transition-colors
                                            ${user.id === selectedUser?.id
                                                ? 'bg-violet-500/20 text-white'
                                                : 'text-white/80 hover:bg-white/10'
                                            }
                                        `}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                                            {user.fullName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{user.fullName}</p>
                                            <p className="text-xs text-white/50 truncate">{user.email}</p>
                                        </div>
                                        {user.id === selectedUser?.id && (
                                            <Check className="w-4 h-4 text-violet-400" />
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
