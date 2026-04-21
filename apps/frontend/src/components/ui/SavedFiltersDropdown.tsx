import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bookmark, 
    ChevronDown, 
    Plus, 
    Star, 
    Trash2, 
    Check,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SavedFilter, useSavedFilters } from '@/hooks/useSavedFilters';

interface SavedFiltersDropdownProps {
    currentFilters: SavedFilter['filters'];
    onApplyFilter: (filters: SavedFilter['filters'] | null) => void;
    className?: string;
}

export const SavedFiltersDropdown: React.FC<SavedFiltersDropdownProps> = ({
    currentFilters,
    onApplyFilter,
    className,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [newFilterName, setNewFilterName] = useState('');
    const [makeDefault, setMakeDefault] = useState(false);

    const {
        savedFilters,
        currentFilter,
        createFilter,
        deleteFilter,
        applyFilter,
        clearFilter,
        setDefault,
        canAddMore,
    } = useSavedFilters();

    const handleSaveFilter = () => {
        if (!newFilterName.trim()) return;
        
        const filter = createFilter(newFilterName.trim(), currentFilters, makeDefault);
        if (filter) {
            setNewFilterName('');
            setMakeDefault(false);
            setShowSaveDialog(false);
        }
    };

    const handleApplyFilter = (filter: SavedFilter) => {
        applyFilter(filter);
        onApplyFilter(filter.filters);
        setIsOpen(false);
    };

    const handleClearFilter = () => {
        clearFilter();
        onApplyFilter(null);
        setIsOpen(false);
    };

    const handleDeleteFilter = (e: React.MouseEvent, filterId: string) => {
        e.stopPropagation();
        deleteFilter(filterId);
    };

    const handleSetDefault = (e: React.MouseEvent, filterId: string) => {
        e.stopPropagation();
        setDefault(filterId);
    };

    return (
        <div className={cn("relative", className)}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors duration-150",
                    "text-sm font-medium",
                    currentFilter
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                )}
            >
                <Bookmark className={cn("w-4 h-4", currentFilter && "fill-primary")} />
                <span className="hidden sm:inline">
                    {currentFilter ? currentFilter.name : 'Saved Views'}
                </span>
                <ChevronDown className={cn(
                    "w-4 h-4 transition-transform",
                    isOpen && "rotate-180"
                )} />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsOpen(false)}
                        />
                        
                        {/* Menu */}
                        <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-2 w-64 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                        >
                            {/* Saved Filters List */}
                            {savedFilters.length > 0 ? (
                                <div className="max-h-64 overflow-y-auto py-1">
                                    {savedFilters.map((filter) => (
                                        <div
                                            key={filter.id}
                                            onClick={() => handleApplyFilter(filter)}
                                            className={cn(
                                                "flex items-center justify-between px-3 py-2 cursor-pointer transition-colors",
                                                currentFilter?.id === filter.id
                                                    ? "bg-primary/10"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {currentFilter?.id === filter.id && (
                                                    <Check className="w-4 h-4 text-primary shrink-0" />
                                                )}
                                                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                                    {filter.name}
                                                </span>
                                                {filter.isDefault && (
                                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-1 shrink-0">
                                                {!filter.isDefault && (
                                                    <button
                                                        onClick={(e) => handleSetDefault(e, filter.id)}
                                                        className="p-1 text-slate-400 hover:text-amber-500 rounded"
                                                        title="Set as default"
                                                    >
                                                        <Star className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => handleDeleteFilter(e, filter.id)}
                                                    className="p-1 text-slate-400 hover:text-red-500 rounded"
                                                    title="Delete filter"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="px-4 py-6 text-center text-sm text-slate-500">
                                    No saved filters yet
                                </div>
                            )}

                            {/* Actions */}
                            <div className="border-t border-slate-200 dark:border-slate-700 p-2 space-y-1">
                                {currentFilter && (
                                    <button
                                        onClick={handleClearFilter}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                        Clear current filter
                                    </button>
                                )}
                                
                                {canAddMore && (
                                    <button
                                        onClick={() => {
                                            setShowSaveDialog(true);
                                            setIsOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Save current view
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Save Dialog */}
            <AnimatePresence>
                {showSaveDialog && (
                    <>
                        <div 
                            className="fixed inset-0 bg-black/50 z-50"
                            onClick={() => setShowSaveDialog(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6"
                        >
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
                                Save Current View
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Filter Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newFilterName}
                                        onChange={(e) => setNewFilterName(e.target.value)}
                                        placeholder="e.g., My Open Tickets"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveFilter();
                                            if (e.key === 'Escape') setShowSaveDialog(false);
                                        }}
                                    />
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={makeDefault}
                                        onChange={(e) => setMakeDefault(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        Set as default view
                                    </span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setShowSaveDialog(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveFilter}
                                    disabled={!newFilterName.trim()}
                                    className="px-4 py-2 text-sm font-medium bg-primary text-slate-900 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Save Filter
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SavedFiltersDropdown;
