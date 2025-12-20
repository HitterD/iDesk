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
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-3 py-2 min-w-[140px]
                    bg-white dark:bg-slate-800 
                    border border-slate-200 dark:border-slate-700 
                    rounded-lg text-sm
                    hover:border-violet-400/50 transition-colors
                    ${isOpen ? 'ring-2 ring-violet-500/30 border-violet-400/50' : ''}
                `}
            >
                {selectedConfig ? (
                    <>
                        <span className="text-base">{selectedConfig.icon}</span>
                        <span className="text-slate-800 dark:text-white truncate flex-1 text-left">
                            {selectedConfig.label}
                        </span>
                    </>
                ) : (
                    <>
                        <Zap className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-500 dark:text-slate-400 flex-1 text-left">All Actions</span>
                    </>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 w-64 max-h-80 overflow-hidden rounded-xl bg-gray-800/95 backdrop-blur-xl border border-white/10 shadow-xl z-[100]"
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
                                    ${!value ? 'bg-violet-500/20 text-white' : 'text-white/80 hover:bg-white/10'}
                                `}
                            >
                                <Zap className="w-4 h-4 text-violet-400" />
                                <span className="text-sm">All Actions</span>
                                {!value && <Check className="w-4 h-4 text-violet-400 ml-auto" />}
                            </button>

                            {/* Grouped Actions */}
                            {Object.entries(actionGroups).map(([group, actions]) => (
                                <div key={group}>
                                    <div className="px-3 py-2 text-xs font-bold text-white/40 uppercase tracking-wider">
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
                                                    ${value === action ? 'bg-violet-500/20 text-white' : 'text-white/80 hover:bg-white/10'}
                                                `}
                                            >
                                                <span className="text-base">{config.icon}</span>
                                                <span className="text-sm flex-1">{config.label}</span>
                                                {value === action && <Check className="w-4 h-4 text-violet-400" />}
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
