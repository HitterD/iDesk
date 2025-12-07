import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
    id: string;
    title: string;
    icon?: LucideIcon;
    defaultOpen?: boolean;
    children: React.ReactNode;
    className?: string;
    headerClassName?: string;
    contentClassName?: string;
    badge?: React.ReactNode;
}

// Hook to persist collapse state in localStorage
const useCollapsibleState = (id: string, defaultOpen: boolean): [boolean, (value: boolean) => void] => {
    const storageKey = `collapsible-${id}`;

    const [isOpen, setIsOpen] = useState<boolean>(() => {
        if (typeof window === 'undefined') return defaultOpen;
        const stored = localStorage.getItem(storageKey);
        return stored !== null ? stored === 'true' : defaultOpen;
    });

    useEffect(() => {
        localStorage.setItem(storageKey, String(isOpen));
    }, [isOpen, storageKey]);

    return [isOpen, setIsOpen];
};

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    id,
    title,
    icon: Icon,
    defaultOpen = true,
    children,
    className,
    headerClassName,
    contentClassName,
    badge,
}) => {
    const [isOpen, setIsOpen] = useCollapsibleState(id, defaultOpen);

    return (
        <div className={cn(
            "glass-card overflow-hidden",
            className
        )}>
            {/* Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full flex items-center justify-between px-4 py-3",
                    "bg-white/30 dark:bg-slate-800/30",
                    "hover:bg-white/50 dark:hover:bg-slate-800/50",
                    "transition-colors duration-200",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                    headerClassName
                )}
                aria-expanded={isOpen}
                aria-controls={`collapsible-content-${id}`}
            >
                <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-white">
                    {Icon && <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
                    {title}
                    {badge && <span className="ml-1">{badge}</span>}
                </span>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                </motion.div>
            </button>

            {/* Content */}
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        id={`collapsible-content-${id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{
                            height: 'auto',
                            opacity: 1,
                            transition: {
                                height: { duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] },
                                opacity: { duration: 0.2, delay: 0.05 }
                            }
                        }}
                        exit={{
                            height: 0,
                            opacity: 0,
                            transition: {
                                height: { duration: 0.2, ease: [0.04, 0.62, 0.23, 0.98] },
                                opacity: { duration: 0.1 }
                            }
                        }}
                        className="overflow-hidden"
                    >
                        <div className={cn("p-4", contentClassName)}>
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Compact variant for sidebars
export const CollapsibleSidebarSection: React.FC<CollapsibleSectionProps> = ({
    id,
    title,
    icon: Icon,
    defaultOpen = true,
    children,
    className,
    badge,
}) => {
    const [isOpen, setIsOpen] = useCollapsibleState(id, defaultOpen);

    return (
        <div className={cn("space-y-1", className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                aria-expanded={isOpen}
            >
                <span className="flex items-center gap-2">
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {title}
                    {badge}
                </span>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown className="w-3.5 h-3.5" />
                </motion.div>
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{
                            height: 'auto',
                            opacity: 1,
                            transition: {
                                height: { duration: 0.2 },
                                opacity: { duration: 0.15, delay: 0.05 }
                            }
                        }}
                        exit={{
                            height: 0,
                            opacity: 0,
                            transition: {
                                height: { duration: 0.15 },
                                opacity: { duration: 0.1 }
                            }
                        }}
                        className="overflow-hidden"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CollapsibleSection;
