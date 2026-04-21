import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { REQUEST_PIPELINE, type RequestStatus } from '../../types';
import { STATUS_META, isTerminal } from '../../utils/status.util';

export function StatusPipeline({ current }: { current: RequestStatus }) {
    const terminalBad = current === 'REJECTED' || current === 'CANCELLED';
    const idx = REQUEST_PIPELINE.indexOf(current);

    return (
        <div role="group" aria-label="Status progress" className="w-full">
            {terminalBad && (
                <div className="mb-3 text-xs font-medium" style={{ color: STATUS_META[current].hex }}>
                    {STATUS_META[current].label}
                </div>
            )}
            <ol className="flex items-center gap-0 overflow-x-auto">
                {REQUEST_PIPELINE.map((step, i) => {
                    const done = !terminalBad && i <= idx;
                    const active = i === idx && !isTerminal(current);
                    const meta = STATUS_META[step];
                    return (
                        <li key={step} className="flex items-center flex-1 min-w-[100px]">
                            <motion.div
                                className="flex flex-col items-center gap-1.5"
                                initial={{ opacity: 0.4, y: 4 }}
                                animate={{ opacity: done || active ? 1 : 0.45, y: 0 }}
                                transition={{ duration: 0.3, ease: 'easeOut', delay: i * 0.04 }}
                            >
                                <div
                                    className={`size-8 rounded-full grid place-items-center ring-2 ${active ? 'ring-offset-2' : ''}`}
                                    style={{
                                        background: done ? meta.hex : 'transparent',
                                        color: done ? '#fff' : meta.hex,
                                        borderColor: meta.hex, borderWidth: done ? 0 : 2, borderStyle: 'solid',
                                    }}
                                    aria-current={active ? 'step' : undefined}
                                >
                                    {done ? <Check className="size-4" /> : <span className="text-[11px] font-semibold">{i + 1}</span>}
                                </div>
                                <span className="text-[10px] font-medium tracking-tight text-slate-600">{meta.label}</span>
                            </motion.div>
                            {i < REQUEST_PIPELINE.length - 1 && (
                                <div className="flex-1 h-0.5 mx-1 bg-slate-200 relative overflow-hidden" aria-hidden>
                                    <motion.div
                                        className="absolute inset-y-0 left-0"
                                        style={{ background: meta.hex }}
                                        initial={{ width: 0 }}
                                        animate={{ width: done && i < idx ? '100%' : '0%' }}
                                        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 + i * 0.04 }}
                                    />
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
