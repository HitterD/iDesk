import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, Folder, Clock, ArrowRight, X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface Article {
    id: string;
    title: string;
    category?: string;
    viewCount?: number;
}

interface ArticleSearchAutocompleteProps {
    placeholder?: string;
    className?: string;
    basePath?: string; // Base path for article links, e.g., '/kb' or '/client/kb'
    categories?: string[];
    onSelect?: (article: Article) => void;
    autoFocus?: boolean;
}

// Hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

export const ArticleSearchAutocomplete: React.FC<ArticleSearchAutocompleteProps> = ({
    placeholder = 'Search articles...',
    className,
    basePath = '/kb',
    categories = [],
    onSelect,
    autoFocus = false,
}) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const debouncedQuery = useDebounce(query, 300);

    // Search articles
    const { data: results, isLoading } = useQuery({
        queryKey: ['kb-search', debouncedQuery],
        queryFn: async () => {
            if (!debouncedQuery || debouncedQuery.length < 2) return [];
            const res = await api.get(`/kb/search?q=${encodeURIComponent(debouncedQuery)}`);
            return res.data?.slice(0, 8) || [];
        },
        enabled: debouncedQuery.length >= 2,
        staleTime: 30000,
    });

    // Recent searches from localStorage
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem('kb-recent-searches');
        if (stored) {
            try {
                setRecentSearches(JSON.parse(stored).slice(0, 5));
            } catch {
                setRecentSearches([]);
            }
        }
    }, []);

    const saveRecentSearch = useCallback((searchTerm: string) => {
        const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('kb-recent-searches', JSON.stringify(updated));
    }, [recentSearches]);

    const handleSelectArticle = useCallback((article: Article) => {
        saveRecentSearch(article.title);
        setQuery('');
        setIsOpen(false);

        if (onSelect) {
            onSelect(article);
        } else {
            navigate(`${basePath}/${article.id}`);
        }
    }, [basePath, navigate, onSelect, saveRecentSearch]);

    const handleSelectCategory = useCallback((category: string) => {
        setQuery('');
        setIsOpen(false);
        navigate(`${basePath}?category=${encodeURIComponent(category)}`);
    }, [basePath, navigate]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const items = results?.length ? results : [];
        const totalItems = items.length + categories.length;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % totalItems);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0) {
                    if (selectedIndex < items.length) {
                        handleSelectArticle(items[selectedIndex]);
                    } else {
                        handleSelectCategory(categories[selectedIndex - items.length]);
                    }
                } else if (query) {
                    saveRecentSearch(query);
                    navigate(`${basePath}?search=${encodeURIComponent(query)}`);
                    setIsOpen(false);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                inputRef.current?.blur();
                break;
        }
    }, [results, categories, selectedIndex, query, basePath, navigate, handleSelectArticle, handleSelectCategory, saveRecentSearch]);

    // Reset selected index when results change
    useEffect(() => {
        setSelectedIndex(-1);
    }, [results]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (listRef.current && !listRef.current.contains(e.target as Node) &&
                inputRef.current && !inputRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const showDropdown = isOpen && (query.length >= 2 || recentSearches.length > 0 || categories.length > 0);

    return (
        <div className={cn("relative", className)}>
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className="w-full h-12 pl-12 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors duration-150"
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('');
                            inputRef.current?.focus();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
                {isLoading && query.length >= 2 && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-spin" />
                )}
            </div>

            {/* Dropdown */}
            <AnimatePresence>
                {showDropdown && (
                    <motion.div
                        ref={listRef}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[100]"
                    >
                        <div className="max-h-96 overflow-y-auto">
                            {/* Search Results */}
                            {results && results.length > 0 && (
                                <div className="p-2">
                                    <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Articles
                                    </p>
                                    {results.map((article: Article, index: number) => (
                                        <button
                                            key={article.id}
                                            onClick={() => handleSelectArticle(article)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                                                selectedIndex === index
                                                    ? "bg-primary/10 text-primary"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                            )}
                                        >
                                            <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                                                    {article.title}
                                                </p>
                                                {article.category && (
                                                    <p className="text-xs text-slate-500 truncate">
                                                        {article.category}
                                                    </p>
                                                )}
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* No Results */}
                            {query.length >= 2 && !isLoading && (!results || results.length === 0) && (
                                <div className="px-4 py-8 text-center text-sm text-slate-500">
                                    No articles found for "{query}"
                                </div>
                            )}

                            {/* Categories */}
                            {categories.length > 0 && !query && (
                                <div className="p-2 border-t border-slate-100 dark:border-slate-700">
                                    <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Categories
                                    </p>
                                    {categories.map((category, index) => (
                                        <button
                                            key={category}
                                            onClick={() => handleSelectCategory(category)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                                                selectedIndex === (results?.length || 0) + index
                                                    ? "bg-primary/10 text-primary"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                            )}
                                        >
                                            <Folder className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                                {category}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Recent Searches */}
                            {recentSearches.length > 0 && !query && (
                                <div className="p-2 border-t border-slate-100 dark:border-slate-700">
                                    <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Recent Searches
                                    </p>
                                    {recentSearches.map((search) => (
                                        <button
                                            key={search}
                                            onClick={() => {
                                                setQuery(search);
                                                setIsOpen(true);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                                        >
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                                {search}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                            <div className="flex items-center gap-3">
                                <span>↑↓ Navigate</span>
                                <span>↵ Select</span>
                                <span>Esc Close</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ArticleSearchAutocomplete;
