import React, { useCallback, useRef, CSSProperties } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { cn } from '@/lib/utils';

/**
 * VirtualizedList component for efficient rendering of large lists
 * Uses react-window for windowing/virtualization
 */

export interface VirtualizedListProps<T> {
    items: T[];
    itemHeight: number;
    renderItem: (item: T, index: number, style: CSSProperties) => React.ReactNode;
    className?: string;
    overscanCount?: number;
    onEndReached?: () => void;
    endReachedThreshold?: number;
    emptyState?: React.ReactNode;
    isLoading?: boolean;
    loadingComponent?: React.ReactNode;
}

export function VirtualizedList<T>({
    items,
    itemHeight,
    renderItem,
    className,
    overscanCount = 5,
    onEndReached,
    endReachedThreshold = 3,
    emptyState,
    isLoading,
    loadingComponent,
}: VirtualizedListProps<T>) {
    const listRef = useRef<List>(null);

    const handleItemsRendered = useCallback(
        ({ visibleStopIndex }: { visibleStopIndex: number }) => {
            if (onEndReached && items.length > 0) {
                if (visibleStopIndex >= items.length - endReachedThreshold) {
                    onEndReached();
                }
            }
        },
        [items.length, onEndReached, endReachedThreshold]
    );

    if (isLoading && items.length === 0) {
        return loadingComponent || <div className="p-8 text-center text-slate-500">Loading...</div>;
    }

    if (!items.length) {
        return emptyState || (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <span>No items found</span>
            </div>
        );
    }

    const Row = ({ index, style }: ListChildComponentProps) => {
        const item = items[index];
        return <>{renderItem(item, index, style)}</>;
    };

    return (
        <div className={cn('h-full w-full', className)}>
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        ref={listRef}
                        height={height}
                        width={width}
                        itemCount={items.length}
                        itemSize={itemHeight}
                        overscanCount={overscanCount}
                        onItemsRendered={handleItemsRendered}
                    >
                        {Row}
                    </List>
                )}
            </AutoSizer>
        </div>
    );
}

/**
 * Simple virtualized table rows for use with existing table structure
 */
export interface VirtualizedTableProps<T> {
    items: T[];
    rowHeight: number;
    renderRow: (item: T, index: number) => React.ReactNode;
    containerHeight: number;
    className?: string;
}

export function VirtualizedTable<T>({
    items,
    rowHeight,
    renderRow,
    containerHeight,
    className,
}: VirtualizedTableProps<T>) {
    const Row = ({ index, style }: ListChildComponentProps) => {
        const item = items[index];
        return (
            <div style={style}>
                {renderRow(item, index)}
            </div>
        );
    };

    return (
        <div className={cn('overflow-hidden', className)} style={{ height: containerHeight }}>
            <List
                height={containerHeight}
                width="100%"
                itemCount={items.length}
                itemSize={rowHeight}
                overscanCount={5}
            >
                {Row}
            </List>
        </div>
    );
}

/**
 * Hook to detect when scroll reaches bottom
 */
export function useInfiniteScroll(
    callback: () => void,
    options: { threshold?: number; enabled?: boolean } = {}
) {
    const { threshold = 100, enabled = true } = options;
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (!enabled) return;
            
            if (observerRef.current) {
                observerRef.current.disconnect();
            }

            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        callback();
                    }
                },
                { rootMargin: `${threshold}px` }
            );

            if (node) {
                observerRef.current.observe(node);
            }
        },
        [callback, threshold, enabled]
    );

    return loadMoreRef;
}

export default VirtualizedList;
