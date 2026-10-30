import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Zap } from 'lucide-react';
import { AuditAction, AUDIT_ACTION_CONFIG } from '../../../types/audit.types';

interface AuditActionFilterProps {
    value: string;
    onChange: (action: string) => void;
}

export function AuditActionFilter({ value, onChange }: AuditActionFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedConfig = value ? AUDIT_ACTION_CONFIG[value as AuditAction] : null;

    const actionGroups = {
        'Authentication': ['USER_LOGIN', 'USER_LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE', 'PASSWORD_RESET'],
        'Users': ['USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_ROLE_CHANGE', 'USER_BULK_IMPORT', 'USER_STATUS_TOGGLE'],
        'Tickets': ['CREATE_TICKET', 'UPDATE_TICKET', 'DELETE_TICKET', 'ASSIGN_TICKET', 'STATUS_CHANGE', 'PRIORITY_CHANGE', 'TICKET_CANCEL', 'BULK_UPDATE'],
        'Knowledge Base': ['ARTICLE_CREATE', 'ARTICLE_UPDATE', 'ARTICLE_DELETE', 'ARTICLE_PUBLISH'],
        'Settings': ['SETTINGS_CHANGE', 'SLA_CONFIG_CHANGE'],
        'Zoom': ['ZOOM_BOOKING_CREATE', 'ZOOM_BOOKING_CANCEL', 'ZOOM_BOOKING_RESCHEDULE'],
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`queue-pop ${isOpen ? 'is-open' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={`Action: ${selectedConfig ? selectedConfig.label : 'Semua'}`}
            >
                <span className="queue-pop-k">Action</span>
                <span className="queue-pop-v">{selectedConfig ? selectedConfig.label : 'Semua'}</span>
                <ChevronDown aria-hidden="true" />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 w-64 max-h-80 overflow-hidden rounded-xl bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg z-[100]"
                    >
                        <div className="overflow-y-auto max-h-72 p-1">
                            {/* All Actions Option */}
                            <button
                                onClick={() => {
                                    onChange('');
                                    setIsOpen(false);
                                }}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2 rounded-lg
                                    text-left transition-colors
                                    ${!value ? 'bg-[hsl(var(--primary))]/10 text-primary' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                                `}
                            >
                                <Zap className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs font-medium">All Actions</span>
                                {!value && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                            </button>

                            {/* Grouped Actions */}
                            {Object.entries(actionGroups).map(([group, actions]) => (
                                <div key={group}>
                                    <div className="px-3 py-2 mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        {group}
                                    </div>
                                    {actions.map(action => {
                                        const config = AUDIT_ACTION_CONFIG[action as AuditAction];
                                        if (!config) return null;
                                        return (
                                            <button
                                                key={action}
                                                onClick={() => {
                                                    onChange(action);
                                                    setIsOpen(false);
                                                }}
                                                className={`
                                                    w-full flex items-center gap-3 px-3 py-2 rounded-lg
                                                    text-left transition-colors
                                                    ${value === action ? 'bg-[hsl(var(--primary))]/10 text-primary' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                                                `}
                                            >
                                                <span className="text-base">{config.icon}</span>
                                                <span className="text-xs font-medium flex-1">{config.label}</span>
                                                {value === action && <Check className="w-3.5 h-3.5 text-primary" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
