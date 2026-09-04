import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { REQUEST_PIPELINE, type RequestStatus } from '../../types';
import { STATUS_META, isTerminal } from '../../utils/status.util';

export function StatusPipeline({ current }: { current: RequestStatus }) {
    const terminalBad = current === 'REJECTED' || current === 'CANCELLED';
    const isCompleted = current === 'COMPLETED';
    const idx = REQUEST_PIPELINE.indexOf(current);
    const activeMeta = STATUS_META[current] || STATUS_META.SUBMITTED;

    return (
        <div role="group" aria-label="Status progress" className="w-full">
            {/* Mobile Active Step Summary */}
            <div className="sm:hidden flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2 px-0.5">
                <span>Langkah {idx >= 0 ? idx + 1 : '—'} dari {REQUEST_PIPELINE.length}</span>
                <span className="font-bold" style={{ color: activeMeta.hex }}>
                    {activeMeta.label}
                </span>
            </div>

            {/* Segmented blocks */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none scroll-smooth">
                {REQUEST_PIPELINE.map((step, i) => {
                    const done = !terminalBad && (isCompleted ? i <= idx : i < idx);
                    const active = i === idx && !isTerminal(current);
                    const future = !done && !active;
                    const meta = STATUS_META[step];

                    return (
                        <motion.div
                            key={step}
                            className="flex flex-col items-center gap-1.5 flex-1 min-w-[68px] sm:min-w-[72px]"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: future && !terminalBad ? 0.4 : 1, y: 0 }}
                            transition={{ duration: 0.3, ease: 'easeOut', delay: i * 0.05 }}
                        >
                            {/* Block bar */}
                            <div className="relative w-full h-6 rounded-md overflow-hidden">
                                {/* Background track */}
                                <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800" />

                                {/* Filled portion */}
                                <motion.div
                                    className="absolute inset-0"
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: done || active ? 1 : 0 }}
                                    style={{
                                        originX: 0,
                                        background: done
                                            ? meta.hex
                                            : active
                                            ? `linear-gradient(90deg, ${meta.hex}, ${meta.hex}cc)`
                                            : 'transparent',
                                    }}
                                    transition={{ duration: 0.4, delay: 0.1 + i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                                />

                                {/* Active glow */}
                                {active && (
                                    <motion.div
                                        className="absolute inset-0"
                                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                        style={{
                                            background: `radial-gradient(ellipse at center, ${meta.hex}40 0%, transparent 80%)`,
                                        }}
                                    />
                                )}

                                {/* Icon / number */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {terminalBad && i === idx ? (
                                        <X className="size-3 text-white" />
                                    ) : done ? (
                                        <Check className="size-3 text-white" />
                                    ) : active ? (
                                        <span className="text-xs font-black text-white">{i + 1}</span>
                                    ) : (
                                        <span className="text-xs font-bold text-slate-400 dark:text-slate-600">{i + 1}</span>
                                    )}
                                </div>
                            </div>

                            {/* Label */}
                            <span
                                className="text-xs font-bold text-center leading-tight tracking-tight whitespace-nowrap"
                                style={{ color: active ? meta.hex : done ? meta.hex : undefined }}
                                aria-current={active ? 'step' : undefined}
                            >
                                <span className={active || done ? '' : 'text-slate-400 dark:text-slate-600'}>
                                    {meta.label}
                                </span>
                            </span>
                        </motion.div>
                    );
                })}
            </div>

            {/* Terminal status banner */}
            {terminalBad && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold"
                    style={{
                        backgroundColor: `${STATUS_META[current].hex}12`,
                        borderColor: `${STATUS_META[current].hex}30`,
                        color: STATUS_META[current].hex,
                    }}
                >
                    <X className="size-3.5 shrink-0" />
                    Request ini telah {STATUS_META[current].label.toLowerCase()}
                </motion.div>
            )}
        </div>
    );
}
