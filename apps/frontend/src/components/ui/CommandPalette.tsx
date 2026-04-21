import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Ticket,
  BookOpen,
  Plus,
  Settings,
  Users,
  BarChart3,
  Home,
  FileText,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import api from '@/lib/api';

// Detect if user is on Mac
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  category: 'navigation' | 'action' | 'ticket' | 'article' | 'recent';
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fetch recent tickets for search
  const { data: tickets = [] } = useQuery({
    queryKey: ['command-tickets', query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await api.get(`/tickets?search=${query}&limit=5`);
      return res.data;
    },
    enabled: query.length >= 2 && isOpen,
    staleTime: 30000,
  });

  // Fetch KB articles for search
  const { data: articles = [] } = useQuery({
    queryKey: ['command-articles', query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await api.get(`/kb/articles?q=${query}&limit=5`);
      return res.data;
    },
    enabled: query.length >= 2 && isOpen,
    staleTime: 30000,
  });

  // Build command items
  const items = useMemo(() => {
    const commands: CommandItem[] = [];

    // Navigation commands
    const navItems: CommandItem[] = [
      {
        id: 'nav-dashboard',
        title: 'Go to Dashboard',
        icon: Home,
        action: () => { navigate('/dashboard'); onClose(); },
        category: 'navigation',
        keywords: ['home', 'dashboard', 'overview'],
      },
      {
        id: 'nav-tickets',
        title: 'Go to Tickets',
        icon: Ticket,
        action: () => { navigate('/tickets/list'); onClose(); },
        category: 'navigation',
        keywords: ['tickets', 'list', 'all'],
      },
      {
        id: 'nav-kb',
        title: 'Go to Knowledge Base',
        icon: BookOpen,
        action: () => { navigate('/kb'); onClose(); },
        category: 'navigation',
        keywords: ['knowledge', 'articles', 'docs'],
      },
    ];

    // Admin only navigation
    if (user?.role === 'ADMIN') {
      navItems.push(
        {
          id: 'nav-agents',
          title: 'Go to Agents',
          icon: Users,
          action: () => { navigate('/agents'); onClose(); },
          category: 'navigation',
          keywords: ['agents', 'users', 'team'],
        },
        {
          id: 'nav-reports',
          title: 'Go to Reports',
          icon: BarChart3,
          action: () => { navigate('/reports'); onClose(); },
          category: 'navigation',
          keywords: ['reports', 'analytics', 'stats'],
        },
        {
          id: 'nav-settings',
          title: 'Go to Settings',
          icon: Settings,
          action: () => { navigate('/settings'); onClose(); },
          category: 'navigation',
          keywords: ['settings', 'config', 'preferences'],
        }
      );
    }

    // Quick actions
    const actionItems: CommandItem[] = [
      {
        id: 'action-new-ticket',
        title: 'Create New Ticket',
        description: 'Open a new support ticket',
        icon: Plus,
        action: () => { navigate('/tickets/create'); onClose(); },
        category: 'action',
        keywords: ['new', 'create', 'ticket', 'add'],
      },
      {
        id: 'action-new-article',
        title: 'Write New Article',
        description: 'Create a knowledge base article',
        icon: FileText,
        action: () => { navigate('/kb/create'); onClose(); },
        category: 'action',
        keywords: ['new', 'create', 'article', 'write'],
      },
    ];

    // Filter based on query
    const lowerQuery = query.toLowerCase();
    
    if (!query) {
      commands.push(...actionItems, ...navItems);
    } else {
      // Filter navigation and actions
      const filteredNav = navItems.filter(item => 
        item.title.toLowerCase().includes(lowerQuery) ||
        item.keywords?.some(k => k.includes(lowerQuery))
      );
      const filteredActions = actionItems.filter(item => 
        item.title.toLowerCase().includes(lowerQuery) ||
        item.keywords?.some(k => k.includes(lowerQuery))
      );
      
      commands.push(...filteredActions, ...filteredNav);

      // Add ticket results
      tickets.forEach((ticket: any) => {
        commands.push({
          id: `ticket-${ticket.id}`,
          title: ticket.title,
          description: `#${ticket.ticketNumber || ticket.id.slice(0, 8)} • ${ticket.status}`,
          icon: Ticket,
          action: () => { navigate(`/tickets/${ticket.id}`); onClose(); },
          category: 'ticket',
        });
      });

      // Add article results
      articles.forEach((article: any) => {
        commands.push({
          id: `article-${article.id}`,
          title: article.title,
          description: article.category,
          icon: BookOpen,
          action: () => { navigate(`/kb/${article.id}`); onClose(); },
          category: 'article',
        });
      });
    }

    return commands;
  }, [query, tickets, articles, user, navigate, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, items.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex]) {
            items[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, items, selectedIndex, onClose]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  if (!isOpen) return null;

  const groupedItems = {
    action: items.filter(i => i.category === 'action'),
    navigation: items.filter(i => i.category === 'navigation'),
    ticket: items.filter(i => i.category === 'ticket'),
    article: items.filter(i => i.category === 'article'),
  };

  let itemIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-in"
        onClick={onClose}
      />
      
      {/* Command Panel */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-modal-in">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 border-b border-slate-200 dark:border-slate-700">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickets, articles, or type a command..."
            className="flex-1 h-14 bg-transparent text-lg text-slate-800 dark:text-white placeholder:text-slate-400 outline-none"
            autoFocus
          />
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No results found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <>
              {/* Quick Actions */}
              {groupedItems.action.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Quick Actions
                  </p>
                  {groupedItems.action.map((item) => {
                    itemIndex++;
                    const isSelected = itemIndex === selectedIndex;
                    return (
                      <CommandItemRow 
                        key={item.id} 
                        item={item} 
                        isSelected={isSelected}
                        onClick={item.action}
                      />
                    );
                  })}
                </div>
              )}

              {/* Navigation */}
              {groupedItems.navigation.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Navigation
                  </p>
                  {groupedItems.navigation.map((item) => {
                    itemIndex++;
                    const isSelected = itemIndex === selectedIndex;
                    return (
                      <CommandItemRow 
                        key={item.id} 
                        item={item} 
                        isSelected={isSelected}
                        onClick={item.action}
                      />
                    );
                  })}
                </div>
              )}

              {/* Tickets */}
              {groupedItems.ticket.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Tickets
                  </p>
                  {groupedItems.ticket.map((item) => {
                    itemIndex++;
                    const isSelected = itemIndex === selectedIndex;
                    return (
                      <CommandItemRow 
                        key={item.id} 
                        item={item} 
                        isSelected={isSelected}
                        onClick={item.action}
                      />
                    );
                  })}
                </div>
              )}

              {/* Articles */}
              {groupedItems.article.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Knowledge Base
                  </p>
                  {groupedItems.article.map((item) => {
                    itemIndex++;
                    const isSelected = itemIndex === selectedIndex;
                    return (
                      <CommandItemRow 
                        key={item.id} 
                        item={item} 
                        isSelected={isSelected}
                        onClick={item.action}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">Esc</kbd>
              Close
            </span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">
              {isMac() ? '⌘' : 'Ctrl'}+K
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
};

// Individual command item
const CommandItemRow: React.FC<{
  item: CommandItem;
  isSelected: boolean;
  onClick: () => void;
}> = ({ item, isSelected, onClick }) => {
  const Icon = item.icon;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors group",
        isSelected 
          ? "bg-primary/10 text-primary" 
          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
        isSelected 
          ? "bg-primary/20" 
          : "bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.title}</p>
        {item.description && (
          <p className="text-xs text-slate-500 truncate">{item.description}</p>
        )}
      </div>
      <ArrowRight className={cn(
        "w-4 h-4 transition-transform",
        isSelected ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
      )} />
    </button>
  );
};

// Hook for opening command palette
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
};

export default CommandPalette;
