import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Site } from '@/types/admin.types';

/**
 * Tall enough for a full AgentCard including a wrapped badge row — a short row
 * clips the card it holds, and the previous 200px cut off the footer entirely.
 */
const DEFAULT_ITEM_HEIGHT = 320;
/** Minimum, not fixed: columns stretch to fill leftover container width. */
const DEFAULT_MIN_ITEM_WIDTH = 260;
const DEFAULT_GAP = 16;
/** Rows rendered beyond the viewport on each side, so scrolling never shows a gap. */
const ROW_OVERSCAN = 2;

// GridUser for virtualized display - minimal required fields
interface GridUser {
    id: string;
    fullName: string;
    email: string;
    role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER';
    site?: Site;
    isActive?: boolean;
    avatarUrl?: string;
    // Performance stats
    openTickets?: number;
    inProgressTickets?: number;
    resolvedThisWeek?: number;
    resolvedThisMonth?: number;
    slaCompliance?: number;
    // Scoring — carried so a virtualized card shows the same numbers as a plain one.
    appraisalPoints?: number;
    activeWorkloadPoints?: number;
}

interface VirtualizedAgentGridProps {
    users: GridUser[];
    selectedIds: Set<string>;
    onSelect: (id: string) => void;
    onViewDetails: (user: GridUser) => void;
    onEdit: (user: GridUser) => void;
    onDelete?: (user: GridUser) => void;  // Made optional
    renderCard: (user: GridUser, isSelected: boolean) => React.ReactNode;
    itemHeight?: number;
    /** Narrowest a column may get before the grid drops to fewer columns. */
    minItemWidth?: number;
    gap?: number;
}

export const VirtualizedAgentGrid: React.FC<VirtualizedAgentGridProps> = ({
    users,
    selectedIds,
    onSelect,
    onViewDetails,
    onEdit,
    onDelete,
    renderCard,
    itemHeight = DEFAULT_ITEM_HEIGHT,
    minItemWidth = DEFAULT_MIN_ITEM_WIDTH,
    gap = DEFAULT_GAP,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
    const [containerWidth, setContainerWidth] = useState(0);

    // Calculate grid dimensions. Columns divide the container instead of taking a
    // fixed width, so the last column no longer leaves a dead strip on the right.
    const columns = Math.max(1, Math.floor((containerWidth + gap) / (minItemWidth + gap)));
    const itemWidth = containerWidth > 0
        ? (containerWidth - gap * (columns - 1)) / columns
        : minItemWidth;
    const rows = Math.ceil(users.length / columns);
    const totalHeight = Math.max(0, rows * (itemHeight + gap) - gap);

    // Calculate visible rows based on scroll position
    const updateVisibleRange = useCallback(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const scrollTop = container.scrollTop;
        const viewportHeight = container.clientHeight;

        const rowHeight = itemHeight + gap;
        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - ROW_OVERSCAN);
        const endRow = Math.min(rows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + ROW_OVERSCAN);

        const startIndex = startRow * columns;
        const endIndex = Math.min(users.length, endRow * columns);

        setVisibleRange({ start: startIndex, end: endIndex });
    }, [columns, rows, itemHeight, gap, users.length]);

    // Handle resize
    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });

        // Width comes from contentRect only. `clientWidth` includes the container's
        // padding, so seeding with it made the first paint lay out 32px too wide.
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Handle scroll
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            requestAnimationFrame(updateVisibleRange);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        updateVisibleRange(); // Initial calculation

        return () => container.removeEventListener('scroll', handleScroll);
    }, [updateVisibleRange]);

    // Get visible users
    const visibleUsers = users.slice(visibleRange.start, visibleRange.end);

    return (
        <div
            ref={containerRef}
            className="h-full overflow-auto p-4"
            style={{ contain: 'strict' }}
        >
            <div
                className="relative"
                style={{ height: totalHeight, minHeight: '100%' }}
            >
                {visibleUsers.map((user, index) => {
                    const actualIndex = visibleRange.start + index;
                    const row = Math.floor(actualIndex / columns);
                    const col = actualIndex % columns;
                    const top = row * (itemHeight + gap);
                    const left = col * (itemWidth + gap);
                    const isSelected = selectedIds.has(user.id);

                    return (
                        <div
                            key={user.id}
                            className="absolute transition-transform"
                            style={{
                                top,
                                left,
                                width: itemWidth,
                                height: itemHeight,
                            }}
                        >
                            {renderCard(user, isSelected)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Utility hook for virtualized list
export const useVirtualization = (
    totalItems: number,
    containerRef: React.RefObject<HTMLDivElement>,
    itemHeight: number,
    overscan: number = 3
) => {
    const [range, setRange] = useState({ start: 0, end: 20 });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateRange = () => {
            const scrollTop = container.scrollTop;
            const viewportHeight = container.clientHeight;

            const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
            const end = Math.min(
                totalItems,
                Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
            );

            setRange({ start, end });
        };

        container.addEventListener('scroll', updateRange, { passive: true });
        updateRange();

        return () => container.removeEventListener('scroll', updateRange);
    }, [totalItems, itemHeight, overscan, containerRef]);

    return range;
};
