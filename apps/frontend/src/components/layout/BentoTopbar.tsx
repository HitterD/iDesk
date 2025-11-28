import { useState, useEffect, useRef } from 'react';
import { Search, Ticket, FileText, Loader2, X, User, Clock, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NotificationPopover } from '../notifications/NotificationPopover';
import { ThemeToggle } from '../ui/ThemeToggle';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';

interface UnifiedSearchResult {
    tickets: Array<{
        id: string;
        ticketNumber: string;
        title: string;
        status: string;
        priority: string;
        userName?: string;
        highlight?: string;
    }>;
    users: Array<{
        id: string;
        fullName: string;
        email: string;
        department?: string;
        role: string;
    }>;
    articles: Array<{
        id: string;
        title: string;
        category?: string;
        highlight?: string;
    }>;
    totalCount: number;
    timing: number;
}

export const BentoTopbar = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const searchRef = useRef<HTMLDivElement>(null);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Unified Search API
    const { data: searchResults, isLoading } = useQuery<UnifiedSearchResult>({
        queryKey: ['unified-search', debouncedQuery],
        queryFn: async () => {
            const res = await api.get(`/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`);
            return res.data;
        },
        enabled: debouncedQuery.length >= 2,
    });

    const hasResults = searchResults && searchResults.totalCount > 0;
    const showDropdown = isOpen && debouncedQuery.length >= 2;

    const handleTicketClick = (id: string) => {
        setIsOpen(false);
        setSearchQuery('');
        const basePath = user?.role === 'USER' ? '/client/tickets' : '/tickets';
        navigate(`${basePath}/${id}`);
    };

    const handleUserClick = (_id: string) => {
        setIsOpen(false);
        setSearchQuery('');
        navigate(`/agents`); // TODO: navigate to /users/${_id} when user detail page exists
    };

    const handleArticleClick = (id: string) => {
        setIsOpen(false);
        setSearchQuery('');
        navigate(`/knowledge-base/article/${id}`);
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'TODO': return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
            case 'IN_PROGRESS': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
            case 'WAITING_VENDOR': return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
            case 'RESOLVED': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
            case 'CANCELLED': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
        }
    };

    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'CRITICAL': return 'text-red-500';
            case 'HIGH': return 'text-orange-500';
            case 'MEDIUM': return 'text-yellow-500';
            case 'LOW': return 'text-slate-400';
            default: return 'text-slate-400';
        }
    };

    return (
        <header className="h-20 px-8 flex items-center justify-between bg-transparent">
            <div className="flex-1 max-w-xl" ref={searchRef}>
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors z-10" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        placeholder="Search tickets, articles..."
                        className="w-full pl-12 pr-10 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:shadow-md transition-all duration-300 placeholder:text-slate-400 text-slate-700 dark:text-slate-200"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setIsOpen(false);
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}

                    {/* Search Results Dropdown */}
                    {showDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                    <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">Searching...</span>
                                </div>
                            ) : hasResults ? (
                                <div>
                                    {/* Tickets Section */}
                                    {searchResults.tickets.length > 0 && (
                                        <div className="border-b border-slate-100 dark:border-slate-700">
                                            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
                                                <Ticket className="w-4 h-4 text-primary" />
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    Tickets ({searchResults.tickets.length})
                                                </span>
                                            </div>
                                            {searchResults.tickets.map((ticket) => (
                                                <button
                                                    key={ticket.id}
                                                    onClick={() => handleTicketClick(ticket.id)}
                                                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                                                >
                                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                        <Ticket className="w-5 h-5 text-primary" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-xs font-mono text-slate-400">#{ticket.ticketNumber}</span>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(ticket.priority).replace('text-', 'bg-')}`}></span>
                                                        </div>
                                                        <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                                                            {ticket.title}
                                                        </p>
                                                        {ticket.userName && (
                                                            <p className="text-xs text-slate-400 truncate">{ticket.userName}</p>
                                                        )}
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(ticket.status)}`}>
                                                        {ticket.status.replace('_', ' ')}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Users Section */}
                                    {searchResults.users.length > 0 && (
                                        <div className="border-b border-slate-100 dark:border-slate-700">
                                            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
                                                <User className="w-4 h-4 text-green-500" />
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    Users ({searchResults.users.length})
                                                </span>
                                            </div>
                                            {searchResults.users.map((userItem) => (
                                                <button
                                                    key={userItem.id}
                                                    onClick={() => handleUserClick(userItem.id)}
                                                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                                                >
                                                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                        <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                                                            {userItem.fullName}
                                                        </p>
                                                        <p className="text-xs text-slate-400 truncate">{userItem.email}</p>
                                                        {userItem.department && (
                                                            <p className="text-xs text-slate-500 truncate">{userItem.department}</p>
                                                        )}
                                                    </div>
                                                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        {userItem.role}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Articles Section */}
                                    {searchResults.articles.length > 0 && (
                                        <div>
                                            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-purple-500" />
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    Knowledge Base ({searchResults.articles.length})
                                                </span>
                                            </div>
                                            {searchResults.articles.map((article) => (
                                                <button
                                                    key={article.id}
                                                    onClick={() => handleArticleClick(article.id)}
                                                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                                                >
                                                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                                        <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                                                            {article.title}
                                                        </p>
                                                        {article.category && (
                                                            <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                                                                <Tag className="w-3 h-3" />
                                                                {article.category}
                                                            </p>
                                                        )}
                                                        {article.highlight && (
                                                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{article.highlight}</p>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Footer with timing */}
                                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-400 flex items-center justify-between">
                                        <span>Found {searchResults.totalCount} results</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {searchResults.timing}ms
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center">
                                    <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400">No results found for "{debouncedQuery}"</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try different keywords</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 ml-4">
                <ThemeToggle />
                <NotificationPopover />
            </div>
        </header>
    );
};
