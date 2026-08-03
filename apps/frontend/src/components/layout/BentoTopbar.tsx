import { useState, useEffect, useRef } from 'react';
import { Search, Ticket, FileText, Loader2, X, User, Clock, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NotificationPopover } from '../notifications/NotificationPopover';
import { ActionCommandCenter } from '../notifications/ActionCommandCenter';
import { ThemeToggle } from '../ui/ThemeToggle';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';

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
    const inputRef = useRef<HTMLInputElement>(null);
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        setIsMac(typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform));
    }, []);

    const [selectedIndex, setSelectedIndex] = useState<number>(-1);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset selected index when debounced query changes
    useEffect(() => {
        setSelectedIndex(-1);
    }, [debouncedQuery]);

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

    // Flat array of search results for index calculation and keyboard navigation
    const flatResults = [
        ...(searchResults?.tickets.map(t => ({ type: 'ticket' as const, id: t.id })) || []),
        ...(searchResults?.users.map(u => ({ type: 'user' as const, id: u.id })) || []),
        ...(searchResults?.articles.map(a => ({ type: 'article' as const, id: a.id })) || []),
    ];

    // Global keyboard shortcut for Ctrl+K / Cmd+K and Arrow navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                const target = e.target as HTMLElement;
                const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
                if (!isInput || target === inputRef.current) {
                    e.preventDefault();
                    inputRef.current?.focus();
                    setIsOpen(true);
                }
            } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
                setIsOpen(false);
                inputRef.current?.blur();
            } else if (showDropdown && flatResults.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex(prev => (prev + 1) % flatResults.length);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex(prev => (prev - 1 + flatResults.length) % flatResults.length);
                } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < flatResults.length) {
                    e.preventDefault();
                    const item = flatResults[selectedIndex];
                    if (item.type === 'ticket') handleTicketClick(item.id);
                    else if (item.type === 'user') handleUserClick(item.id);
                    else if (item.type === 'article') handleArticleClick(item.id);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showDropdown, flatResults.length, selectedIndex]);

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'TODO': return 'bg-muted text-muted-foreground';
            case 'IN_PROGRESS': return 'bg-primary/10 text-primary';
            case 'WAITING_VENDOR': return 'bg-accent/15 text-accent';
            case 'RESOLVED': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
            case 'CANCELLED': return 'bg-destructive/10 text-destructive';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'CRITICAL': return 'text-destructive';
            case 'HIGH': return 'text-amber-500';
            case 'MEDIUM': return 'text-accent';
            case 'LOW': return 'text-muted-foreground';
            case 'HARDWARE_INSTALLATION': return 'text-primary';
            default: return 'text-muted-foreground';
        }
    };

    let itemCounter = 0;

    return (
        <header className="h-20 px-8 flex items-center justify-between bg-transparent">
            <div className="flex-1 max-w-xl" ref={searchRef}>
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                    <input
                        ref={inputRef}
                        type="text"
                        role="combobox"
                        aria-expanded={showDropdown}
                        aria-haspopup="listbox"
                        aria-autocomplete="list"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        placeholder="Search tickets, articles..."
                        className="w-full pl-12 pr-20 py-3 bg-card/90 dark:bg-card/70 backdrop-blur-sm border border-border rounded-2xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:shadow-md focus:border-primary/40 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out placeholder:text-muted-foreground text-foreground font-sans"
                    />
                    {searchQuery ? (
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setIsOpen(false);
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    ) : (
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none select-none">
                            <kbd className="px-2 py-0.5 text-[11px] font-mono font-medium text-muted-foreground bg-muted border border-border rounded-md shadow-2xs">
                                {isMac ? '⌘K' : 'Ctrl+K'}
                            </kbd>
                        </div>
                    )}

                    {/* Search Results Dropdown */}
                    {showDropdown && (
                        <div role="listbox" className="absolute top-full left-0 right-0 mt-2 bg-popover text-popover-foreground rounded-2xl shadow-xl border border-border backdrop-blur-sm overflow-hidden z-50 max-h-[70vh] overflow-y-auto scrollbar-custom">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                    <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                                </div>
                            ) : hasResults ? (
                                <div>
                                    {/* Tickets Section */}
                                    {searchResults.tickets.length > 0 && (
                                        <div className="border-b border-border">
                                            <div className="px-4 py-2 bg-muted/40 flex items-center gap-2">
                                                <Ticket className="w-4 h-4 text-primary" />
                                                <span className="text-xs font-semibold text-muted-foreground">
                                                    Tickets ({searchResults.tickets.length})
                                                </span>
                                            </div>
                                            {searchResults.tickets.map((ticket) => {
                                                const currentIndex = itemCounter++;
                                                const isSelected = selectedIndex === currentIndex;
                                                return (
                                                    <button
                                                        key={ticket.id}
                                                        role="option"
                                                        aria-selected={isSelected}
                                                        onClick={() => handleTicketClick(ticket.id)}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 p-4 transition-colors text-left",
                                                            isSelected ? "bg-muted/80 ring-1 ring-primary/30" : "hover:bg-muted/30"
                                                        )}
                                                    >
                                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                            <Ticket className="w-5 h-5 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className="text-xs font-mono text-muted-foreground">#{ticket.ticketNumber}</span>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(ticket.priority).replace('text-', 'bg-')}`}></span>
                                                            </div>
                                                            <p className="font-medium text-foreground truncate">
                                                                {ticket.title}
                                                            </p>
                                                            {ticket.userName && (
                                                                <p className="text-xs text-muted-foreground truncate">{ticket.userName}</p>
                                                            )}
                                                        </div>
                                                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(ticket.status)}`}>
                                                            {ticket.status.replace('_', ' ')}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Users Section */}
                                    {searchResults.users.length > 0 && (
                                        <div className="border-b border-border">
                                            <div className="px-4 py-2 bg-muted/40 flex items-center gap-2">
                                                <User className="w-4 h-4 text-emerald-500" />
                                                <span className="text-xs font-semibold text-muted-foreground">
                                                    Users ({searchResults.users.length})
                                                </span>
                                            </div>
                                            {searchResults.users.map((userItem) => {
                                                const currentIndex = itemCounter++;
                                                const isSelected = selectedIndex === currentIndex;
                                                return (
                                                    <button
                                                        key={userItem.id}
                                                        role="option"
                                                        aria-selected={isSelected}
                                                        onClick={() => handleUserClick(userItem.id)}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 p-4 transition-colors text-left",
                                                            isSelected ? "bg-muted/80 ring-1 ring-primary/30" : "hover:bg-muted/30"
                                                        )}
                                                    >
                                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                                            <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-foreground truncate">
                                                                {userItem.fullName}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground truncate">{userItem.email}</p>
                                                            {userItem.department && (
                                                                <p className="text-xs text-muted-foreground/80 truncate">{userItem.department}</p>
                                                            )}
                                                        </div>
                                                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-muted text-muted-foreground">
                                                            {userItem.role}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Articles Section */}
                                    {searchResults.articles.length > 0 && (
                                        <div>
                                            <div className="px-4 py-2 bg-muted/40 flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-accent" />
                                                <span className="text-xs font-semibold text-muted-foreground">
                                                    Knowledge Base ({searchResults.articles.length})
                                                </span>
                                            </div>
                                            {searchResults.articles.map((article) => {
                                                const currentIndex = itemCounter++;
                                                const isSelected = selectedIndex === currentIndex;
                                                return (
                                                    <button
                                                        key={article.id}
                                                        role="option"
                                                        aria-selected={isSelected}
                                                        onClick={() => handleArticleClick(article.id)}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 p-4 transition-colors text-left",
                                                            isSelected ? "bg-muted/80 ring-1 ring-primary/30" : "hover:bg-muted/30"
                                                        )}
                                                    >
                                                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                                                            <FileText className="w-5 h-5 text-accent" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-foreground truncate">
                                                                {article.title}
                                                            </p>
                                                            {article.category && (
                                                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                                    <Tag className="w-3 h-3" />
                                                                    {article.category}
                                                                </p>
                                                            )}
                                                            {article.highlight && (
                                                                <p className="text-xs text-muted-foreground/80 line-clamp-1 mt-0.5">{article.highlight}</p>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Footer with timing */}
                                    <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
                                        <span>Found {searchResults.totalCount} results</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {searchResults.timing}ms
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center">
                                    <Search className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No results found for "{debouncedQuery}"</p>
                                    <p className="text-xs text-muted-foreground/70 mt-1">Try different keywords</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 ml-4">
                <ThemeToggle />
                <ActionCommandCenter />
                <NotificationPopover />
            </div>
        </header>
    );
};
