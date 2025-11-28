import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Ticket, User, FileText, Bookmark, Loader2 } from 'lucide-react';
import { useSearch, useSearchSuggestions, useSavedSearches, SearchFilters } from '../hooks/useSearch';
import { useDebounce } from '@/hooks/useDebounce';

interface GlobalSearchProps {
    onClose?: () => void;
    isModal?: boolean;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onClose, isModal = false }) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [filters] = useState<SearchFilters>({});
    const [selectedScope, setSelectedScope] = useState<('tickets' | 'users' | 'articles')[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    
    const debouncedQuery = useDebounce(query, 300);
    
    const { data: results, isLoading } = useSearch({
        q: debouncedQuery,
        filters: { ...filters, scope: selectedScope.length > 0 ? selectedScope : undefined },
    });
    
    const { data: suggestions } = useSearchSuggestions(query);
    const { data: savedSearches } = useSavedSearches();

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && onClose) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleResultClick = useCallback((type: string, id: string) => {
        switch (type) {
            case 'ticket':
                navigate(`/tickets/${id}`);
                break;
            case 'user':
                navigate(`/users/${id}`);
                break;
            case 'article':
                navigate(`/knowledge-base/${id}`);
                break;
        }
        onClose?.();
    }, [navigate, onClose]);

    const toggleScope = (scope: 'tickets' | 'users' | 'articles') => {
        setSelectedScope(prev => 
            prev.includes(scope) 
                ? prev.filter(s => s !== scope)
                : [...prev, scope]
        );
    };

    const clearSearch = () => {
        setQuery('');
        setSelectedScope([]);
        inputRef.current?.focus();
    };

    const getResultIcon = (type: string) => {
        switch (type) {
            case 'ticket': return <Ticket className="w-4 h-4 text-blue-400" />;
            case 'user': return <User className="w-4 h-4 text-green-400" />;
            case 'article': return <FileText className="w-4 h-4 text-purple-400" />;
            default: return null;
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority?.toUpperCase()) {
            case 'URGENT': return 'text-red-400';
            case 'HIGH': return 'text-orange-400';
            case 'MEDIUM': return 'text-yellow-400';
            case 'LOW': return 'text-green-400';
            default: return 'text-slate-400';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'TODO': return 'bg-blue-500/20 text-blue-400';
            case 'IN_PROGRESS': return 'bg-yellow-500/20 text-yellow-400';
            case 'RESOLVED': return 'bg-green-500/20 text-green-400';
            case 'CANCELLED': return 'bg-red-500/20 text-red-400';
            default: return 'bg-slate-500/20 text-slate-400';
        }
    };

    const containerClass = isModal 
        ? 'fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm'
        : 'w-full';

    const searchBoxClass = isModal
        ? 'w-full max-w-2xl mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden'
        : 'w-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden';

    return (
        <div className={containerClass} onClick={isModal ? onClose : undefined}>
            <div className={searchBoxClass} onClick={e => e.stopPropagation()}>
                {/* Search Input */}
                <div className="flex items-center gap-3 p-4 border-b border-slate-700">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tickets, users, articles..."
                        className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none"
                    />
                    {isLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                    {query && (
                        <button onClick={clearSearch} className="p-1 hover:bg-slate-700 rounded">
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    )}
                    {isModal && (
                        <kbd className="px-2 py-1 text-xs text-slate-500 bg-slate-800 rounded">ESC</kbd>
                    )}
                </div>

                {/* Scope Filters */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/50">
                    <span className="text-xs text-slate-500">Search in:</span>
                    {(['tickets', 'users', 'articles'] as const).map(scope => (
                        <button
                            key={scope}
                            onClick={() => toggleScope(scope)}
                            className={`px-2 py-1 text-xs rounded-full transition-colors ${
                                selectedScope.includes(scope) || selectedScope.length === 0
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {scope.charAt(0).toUpperCase() + scope.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Results */}
                <div className="max-h-96 overflow-y-auto">
                    {/* Show suggestions when no query yet */}
                    {!debouncedQuery && savedSearches && savedSearches.length > 0 && (
                        <div className="p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                <Bookmark className="w-3 h-3" />
                                <span>Saved Searches</span>
                            </div>
                            {savedSearches.slice(0, 5).map(search => (
                                <button
                                    key={search.id}
                                    onClick={() => setQuery(search.query || '')}
                                    className="block w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 rounded"
                                >
                                    {search.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Suggestions while typing */}
                    {query && !debouncedQuery && suggestions && suggestions.length > 0 && (
                        <div className="p-2">
                            {suggestions.map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        if (suggestion.id) {
                                            handleResultClick(suggestion.type, suggestion.id);
                                        } else {
                                            setQuery(suggestion.text);
                                        }
                                    }}
                                    className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-slate-700/50 rounded"
                                >
                                    {getResultIcon(suggestion.type)}
                                    <span className="text-sm text-slate-300">{suggestion.text}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Search Results */}
                    {results && (
                        <div className="p-2">
                            {/* Tickets */}
                            {results.tickets.length > 0 && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 px-3 py-1 text-xs text-slate-500">
                                        <Ticket className="w-3 h-3" />
                                        <span>Tickets ({results.tickets.length})</span>
                                    </div>
                                    {results.tickets.map(ticket => (
                                        <button
                                            key={ticket.id}
                                            onClick={() => handleResultClick('ticket', ticket.id)}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-700/50 rounded"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">{ticket.ticketNumber}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(ticket.status)}`}>
                                                    {ticket.status}
                                                </span>
                                                <span className={`text-xs ${getPriorityColor(ticket.priority)}`}>
                                                    {ticket.priority}
                                                </span>
                                            </div>
                                            <div className="text-sm text-white mt-1">{ticket.title}</div>
                                            {ticket.highlight && (
                                                <div className="text-xs text-slate-400 mt-1 line-clamp-1">
                                                    {ticket.highlight}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Users */}
                            {results.users.length > 0 && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 px-3 py-1 text-xs text-slate-500">
                                        <User className="w-3 h-3" />
                                        <span>Users ({results.users.length})</span>
                                    </div>
                                    {results.users.map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => handleResultClick('user', user.id)}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-700/50 rounded"
                                        >
                                            <div className="text-sm text-white">{user.fullName}</div>
                                            <div className="text-xs text-slate-400">{user.email}</div>
                                            {user.department && (
                                                <div className="text-xs text-slate-500 mt-1">{user.department}</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Articles */}
                            {results.articles.length > 0 && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 px-3 py-1 text-xs text-slate-500">
                                        <FileText className="w-3 h-3" />
                                        <span>Knowledge Base ({results.articles.length})</span>
                                    </div>
                                    {results.articles.map(article => (
                                        <button
                                            key={article.id}
                                            onClick={() => handleResultClick('article', article.id)}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-700/50 rounded"
                                        >
                                            <div className="text-sm text-white">{article.title}</div>
                                            {article.highlight && (
                                                <div className="text-xs text-slate-400 mt-1 line-clamp-2">
                                                    {article.highlight}
                                                </div>
                                            )}
                                            {article.tags && article.tags.length > 0 && (
                                                <div className="flex gap-1 mt-1">
                                                    {article.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* No results */}
                            {results.totalCount === 0 && debouncedQuery && (
                                <div className="p-8 text-center text-slate-500">
                                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No results found for "{debouncedQuery}"</p>
                                    <p className="text-sm mt-1">Try different keywords or filters</p>
                                </div>
                            )}

                            {/* Timing */}
                            {results.totalCount > 0 && (
                                <div className="px-3 py-2 text-xs text-slate-500 border-t border-slate-700/50">
                                    Found {results.totalCount} results in {results.timing}ms
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GlobalSearch;
