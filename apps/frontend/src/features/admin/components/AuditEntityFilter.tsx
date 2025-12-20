import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Layers, User, Ticket, FileText, Settings, Video, Zap } from 'lucide-react';

interface AuditEntityFilterProps {
    value: string;
    onChange: (entity: string) => void;
}

const ENTITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    user: { label: 'Users', icon: <User className="w-4 h-4" />, color: 'text-blue-400' },
    ticket: { label: 'Tickets', icon: <Ticket className="w-4 h-4" />, color: 'text-green-400' },
    article: { label: 'Articles', icon: <FileText className="w-4 h-4" />, color: 'text-amber-400' },
    settings: { label: 'Settings', icon: <Settings className="w-4 h-4" />, color: 'text-slate-400' },
    auth: { label: 'Authentication', icon: <User className="w-4 h-4" />, color: 'text-violet-400' },
    zoom: { label: 'Zoom Booking', icon: <Video className="w-4 h-4" />, color: 'text-cyan-400' },
    automation: { label: 'Automation', icon: <Zap className="w-4 h-4" />, color: 'text-orange-400' },
    sla: { label: 'SLA', icon: <Settings className="w-4 h-4" />, color: 'text-rose-400' },
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
                    bg-white dark:bg-slate-800 
                    border border-slate-200 dark:border-slate-700 
                    rounded-lg text-sm
                    hover:border-violet-400/50 transition-colors
                    ${isOpen ? 'ring-2 ring-violet-500/30 border-violet-400/50' : ''}
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
                        <Layers className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-500 dark:text-slate-400 flex-1 text-left">All Entities</span>
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
                        className="absolute top-full left-0 mt-2 w-56 max-h-80 overflow-hidden rounded-xl bg-gray-800/95 backdrop-blur-xl border border-white/10 shadow-xl z-[100]"
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
                                    ${!value ? 'bg-violet-500/20 text-white' : 'text-white/80 hover:bg-white/10'}
                                `}
                            >
                                <Layers className="w-4 h-4 text-violet-400" />
                                <span className="text-sm font-medium">All Entities</span>
                                {!value && <Check className="w-4 h-4 text-violet-400 ml-auto" />}
                            </button>

                            <div className="h-px bg-white/10 my-1" />

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
                                        ${value === key ? 'bg-violet-500/20 text-white' : 'text-white/80 hover:bg-white/10'}
                                    `}
                                >
                                    <span className={config.color}>{config.icon}</span>
                                    <span className="text-sm font-medium flex-1">{config.label}</span>
                                    {value === key && <Check className="w-4 h-4 text-violet-400" />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
