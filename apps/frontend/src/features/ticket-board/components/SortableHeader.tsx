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
            onClick={() => onSort(field)}
            className={cn(
                "flex items-center gap-1 hover:text-primary transition-colors group",
                isActive && "text-primary font-semibold",
                className
            )}
        >
            <span>{label}</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                {isActive ? (
                    currentSortOrder === 'ASC' ? (
                        <ArrowUp className="w-3 h-3" />
                    ) : (
                        <ArrowDown className="w-3 h-3" />
                    )
                ) : (
                    <ArrowUpDown className="w-3 h-3" />
                )}
            </span>
            {isActive && (
                <span className="opacity-100">
                    {currentSortOrder === 'ASC' ? (
                        <ArrowUp className="w-3 h-3" />
                    ) : (
                        <ArrowDown className="w-3 h-3" />
                    )}
                </span>
            )}
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
