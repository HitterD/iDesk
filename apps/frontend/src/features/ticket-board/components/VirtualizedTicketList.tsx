import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TicketListRow, TicketRowData } from './TicketListRow';
import { Inbox, Search, X } from 'lucide-react';

interface Agent {
    id: string;
    fullName: string;
    avatarUrl?: string;
}

interface VirtualizedTicketListProps {
    tickets: TicketRowData[];
    showSiteColumn: boolean;
    canEdit: boolean;
    selectedTickets: Set<string>;
    agents: Agent[];
    onSelect: (ticketId: string, selected: boolean) => void;
    onUpdatePriority: (ticketId: string, priority: string) => void;
    onUpdateStatus: (ticketId: string, status: string) => void;
    onAssign: (ticketId: string, assigneeId: string) => void;
    /** Optional callback to clear filters */
    onClearFilters?: () => void;
    /** Whether any filters are active */
    hasActiveFilters?: boolean;
}

/**
 * VirtualizedTicketList - Renders a paginated ticket list with keyboard navigation
 * 
 * Design Decision: Virtualization was intentionally removed because:
 * 1. Server-side pagination limits results to 20 items per page
 * 2. Standard DOM rendering is efficient for small lists
 * 3. Removes react-window dependency complexity
 * 4. Eliminates scroll position and focus management issues
 * 
 * Keyboard Navigation:
 * - Arrow Up/Down: Navigate between rows
 * - Enter: Open focused ticket
 * - Space: Toggle selection on focused row
 */
export const VirtualizedTicketList: React.FC<VirtualizedTicketListProps> = ({
    tickets,
    showSiteColumn,
    canEdit,
    selectedTickets,
    agents,
    onSelect,
    onUpdatePriority,
    onUpdateStatus,
    onAssign,
    onClearFilters,
    hasActiveFilters,
}) => {
    const navigate = useNavigate();
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // Keyboard navigation handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (tickets.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, tickets.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                if (focusedIndex >= 0 && focusedIndex < tickets.length) {
                    navigate(`/tickets/${tickets[focusedIndex].id}`);
                }
                break;
            case ' ':
                if (focusedIndex >= 0 && focusedIndex < tickets.length && canEdit) {
                    e.preventDefault();
                    const ticket = tickets[focusedIndex];
                    onSelect(ticket.id, !selectedTickets.has(ticket.id));
                }
                break;
            case 'Escape':
                setFocusedIndex(-1);
                break;
        }
    }, [tickets, focusedIndex, navigate, canEdit, onSelect, selectedTickets]);

    // Reset focus when tickets change
    useEffect(() => {
        setFocusedIndex(-1);
    }, [tickets]);

    // Empty state with illustration
    if (tickets.length === 0) {
        return (
            <div
                className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in-up"
                role="status"
                aria-live="polite"
            >
                {/* Illustrated icon with gradient background */}
                <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shadow-inner">
                        <Inbox className="w-12 h-12 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    </div>
                    {hasActiveFilters && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
                            <Search className="w-3 h-3 text-white" />
                        </div>
                    )}
                </div>

                {/* Text content */}
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    No tickets found
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
                    {hasActiveFilters
                        ? "Try adjusting your search or filter criteria"
                        : "All caught up! No tickets require your attention."}
                </p>

                {/* Action button */}
                {hasActiveFilters && onClearFilters && (
                    <button
                        onClick={onClearFilters}
                        className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors btn-feedback"
                    >
                        <X className="w-4 h-4" />
                        Clear all filters
                    </button>
                )}
            </div>
        );
    }

    // Standard rendering with keyboard navigation
    return (
        <div
            className="divide-y divide-slate-100 dark:divide-slate-800"
            role="listbox"
            aria-label="Ticket list"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onFocus={() => focusedIndex === -1 && setFocusedIndex(0)}
        >
            {tickets.map((ticket, index) => (
                <div
                    key={ticket.id}
                    role="option"
                    aria-selected={selectedTickets.has(ticket.id)}
                    className={focusedIndex === index ? 'ring-2 ring-primary ring-inset' : ''}
                >
                    <TicketListRow
                        ticket={ticket}
                        index={index}
                        showSiteColumn={showSiteColumn}
                        canEdit={canEdit}
                        isSelected={selectedTickets.has(ticket.id)}
                        agents={agents}
                        onSelect={onSelect}
                        onUpdatePriority={onUpdatePriority}
                        onUpdateStatus={onUpdateStatus}
                        onAssign={onAssign}
                    />
                </div>
            ))}
        </div>
    );
};

export default VirtualizedTicketList;

