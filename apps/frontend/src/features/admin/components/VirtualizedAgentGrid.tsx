import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Site } from '@/types/admin.types';

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
    itemWidth?: number;
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
    itemHeight = 200,
    itemWidth = 280,
    gap = 16,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
    const [containerWidth, setContainerWidth] = useState(0);

    // Calculate grid dimensions
    const columns = Math.max(1, Math.floor((containerWidth + gap) / (itemWidth + gap)));
    const rows = Math.ceil(users.length / columns);
    const totalHeight = rows * (itemHeight + gap) - gap;

    // Calculate visible rows based on scroll position
    const updateVisibleRange = useCallback(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const scrollTop = container.scrollTop;
        const viewportHeight = container.clientHeight;

        const rowHeight = itemHeight + gap;
        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 2); // Buffer of 2 rows
        const endRow = Math.min(rows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 2);

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

        if (containerRef.current) {
            observer.observe(containerRef.current);
            setContainerWidth(containerRef.current.clientWidth);
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
            className="overflow-auto h-full"
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
