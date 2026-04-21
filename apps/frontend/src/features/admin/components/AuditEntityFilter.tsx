import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Layers, User, Ticket, FileText, Settings, Video, Zap } from 'lucide-react';

interface AuditEntityFilterProps {
    value: string;
    onChange: (entity: string) => void;
}

const ENTITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    user: { label: 'Users', icon: <User className="w-3.5 h-3.5" />, color: 'text-[hsl(var(--info-500))]' },
    ticket: { label: 'Tickets', icon: <Ticket className="w-3.5 h-3.5" />, color: 'text-[hsl(var(--success-500))]' },
    article: { label: 'Articles', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-[hsl(var(--warning-500))]' },
    settings: { label: 'Settings', icon: <Settings className="w-3.5 h-3.5" />, color: 'text-slate-400 dark:text-slate-500' },
    auth: { label: 'Authentication', icon: <User className="w-3.5 h-3.5" />, color: 'text-primary' },
    zoom: { label: 'Zoom Booking', icon: <Video className="w-3.5 h-3.5" />, color: 'text-[hsl(var(--info-500))]' },
    automation: { label: 'Automation', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-[hsl(var(--warning-500))]' },
    sla: { label: 'SLA', icon: <Settings className="w-3.5 h-3.5" />, color: 'text-[hsl(var(--error-500))]' },
};

export function AuditEntityFilter({ value, onChange }: AuditEntityFilterProps) {
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

    const selectedConfig = value ? ENTITY_CONFIG[value] : null;

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-3 py-2 min-w-[140px]
                    bg-white dark:bg-[hsl(var(--card))]
                    border border-[hsl(var(--border))]
                    rounded-lg text-xs font-medium
                    hover:border-primary/40 transition-colors
                    ${isOpen ? 'ring-2 ring-primary/20 border-primary/40' : ''}
                `}
            >
                {selectedConfig ? (
                    <>
                        <span className={selectedConfig.color}>{selectedConfig.icon}</span>
                        <span className="text-slate-800 dark:text-white truncate flex-1 text-left">
                            {selectedConfig.label}
                        </span>
                    </>
                ) : (
                    <>
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500 dark:text-slate-400 flex-1 text-left">All Entities</span>
                    </>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 w-56 max-h-80 overflow-hidden rounded-xl bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg z-[100]"
                    >
                        <div className="overflow-y-auto max-h-72 p-1">
                            {/* All Entities Option */}
                            <button
                                onClick={() => {
                                    onChange('');
                                    setIsOpen(false);
                                }}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                    text-left transition-colors
                                    ${!value ? 'bg-[hsl(var(--primary))]/10 text-primary' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                                `}
                            >
                                <Layers className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs font-medium">All Entities</span>
                                {!value && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                            </button>

                            <div className="h-px bg-[hsl(var(--border))] my-1 mx-2" />

                            {/* Entity Options */}
                            {Object.entries(ENTITY_CONFIG).map(([key, config]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        onChange(key);
                                        setIsOpen(false);
                                    }}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                        text-left transition-colors
                                        ${value === key ? 'bg-[hsl(var(--primary))]/10 text-primary' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                                    `}
                                >
                                    <span className={config.color}>{config.icon}</span>
                                    <span className="text-xs font-medium flex-1">{config.label}</span>
                                    {value === key && <Check className="w-3.5 h-3.5 text-primary" />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
