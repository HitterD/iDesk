import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortField = 'createdAt' | 'updatedAt' | 'priority' | 'status' | 'title' | '';
export type SortOrder = 'ASC' | 'DESC';

interface SortableHeaderProps {
    label: string;
    field: SortField;
    currentSortBy: SortField;
    currentSortOrder: SortOrder;
    onSort: (field: SortField) => void;
    className?: string;
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({
    label,
    field,
    currentSortBy,
    currentSortOrder,
    onSort,
    className,
}) => {
    const isActive = currentSortBy === field;

    return (
        <button
            type="button"
            onClick={() => onSort(field)}
            className={cn(
                "inline-flex items-center gap-1.5 hover:text-primary transition-colors group cursor-pointer text-xs font-bold uppercase tracking-wider",
                isActive ? "text-primary font-bold" : "text-muted-foreground",
                className
            )}
        >
            <span>{label}</span>
            <span className={cn(
                "transition-all duration-150",
                isActive ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-60 text-muted-foreground"
            )}>
                {isActive ? (
                    currentSortOrder === 'ASC' ? (
                        <ArrowUp className="w-3.5 h-3.5" />
                    ) : (
                        <ArrowDown className="w-3.5 h-3.5" />
                    )
                ) : (
                    <ArrowUpDown className="w-3.5 h-3.5" />
                )}
            </span>
        </button>
    );

};

// Non-sortable header for consistency
interface TableHeaderProps {
    label: string;
    className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ label, className }) => (
    <div className={className}>{label}</div>
);
