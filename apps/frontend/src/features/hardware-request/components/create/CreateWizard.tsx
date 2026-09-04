import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Cpu, Save, Send } from 'lucide-react';
import { InfoStep } from './InfoStep';
import { ItemsStep } from './ItemsStep';
import { ReviewStep } from './ReviewStep';
import { HardwareRequestApi } from '../../api/hardware-request.api';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import { cn } from '@/lib/utils';

const schema = z.object({
    requestType: z.enum(['BUDGET_ANNUAL', 'NON_BUDGET']),
    division: z.string().min(1, 'Divisi penerima wajib diisi'),
    recipientNames: z.array(z.string()),
    recipientName: z.string().optional(),
    justification: z.string().min(1, 'Justifikasi kebutuhan wajib diisi'),
    items: z
        .array(
            z.object({
                catalogId: z.string().min(1, 'Pilih item katalog'),
                quantity: z.number().int().min(1).max(50),
                specs: z.record(z.string(), z.unknown()).optional(),
                recipientName: z.string().optional(),
            }),
        )
        .min(1, 'Pilih minimal 1 item dari katalog'),
});

export type CreateFormValues = z.infer<typeof schema>;

const STEPS = [
    { title: 'Info Permintaan', desc: 'Divisi & Penerima' },
    { title: 'Pilih Item', desc: 'Katalog Perangkat' },
    { title: 'Review & Submit', desc: 'Periksa & Ajukan' },
] as const;

export function CreateWizard() {
    const nav = useNavigate();
    const basePath = useHardwareBasePath();
    const [step, setStep] = useState(0);
    const form = useForm<CreateFormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: {
            requestType: 'BUDGET_ANNUAL',
            justification: '',
            items: [],
            recipientNames: [],
            recipientName: '',
            division: '',
        },
        mode: 'onBlur',
    });
    const [saving, setSaving] = useState(false);

    const onSubmit = async (values: CreateFormValues, action: 'draft' | 'submit') => {
        try {
            setSaving(true);
            const payload = {
                division: values.division,
                recipientName: values.recipientNames?.length ? values.recipientNames.join(', ') : values.recipientName,
                justification: `[${values.requestType === 'NON_BUDGET' ? 'NON-BUDGET' : 'BUDGET TAHUNAN'}] ${values.justification}`,
                items: values.items.map((i) => ({
                    catalogId: i.catalogId,
                    quantity: i.quantity,
                    customFields: { ...i.specs, recipientName: i.recipientName },
                })),
            };
            const req = await HardwareRequestApi.create(payload);
            if (action === 'submit') await HardwareRequestApi.submit(req.id);
            toast.success(action === 'submit' ? 'Hardware request berhasil diajukan!' : 'Draft tersimpan');
            nav(`${basePath}/${req.id}`);
        } catch (e: any) {
            toast.error(e?.message ?? 'Gagal menyimpan request');
        } finally {
            setSaving(false);
        }
    };

    const next = async () => {
        const fields: (keyof CreateFormValues)[] =
            step === 0 ? ['division', 'justification'] : step === 1 ? ['items'] : [];
        const ok = await form.trigger(fields);
        if (!ok) {
            const err = form.formState.errors;
            if (step === 0) {
                if (err.division) toast.error('Pilih divisi penerima');
                else if (err.justification) toast.error('Isi justifikasi kebutuhan');
            } else if (step === 1) {
                if (err.items) toast.error('Pilih minimal 1 item dari katalog');
            }
            return;
        }
        setStep((s) => Math.min(2, s + 1));
    };

    return (
        <FormProvider {...form}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in-up pb-16">
                {/* Header */}
                <div className="flex items-center gap-3.5 border-b border-border pb-5">
                    <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Cpu className="size-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                            Pengajuan Hardware Request
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                            Form realisasi budget tahunan & pengadaan perangkat kerja ICT
                        </p>
                    </div>
                </div>

                {/* Step Indicator */}
                <nav aria-label="Wizard Steps" className="bg-card border border-border rounded-2xl p-3 shadow-xs">
                    <div className="grid grid-cols-3 gap-2">
                        {STEPS.map((s, i) => {
                            const isDone = i < step;
                            const isCurrent = i === step;
                            return (
                                <button
                                    key={s.title}
                                    type="button"
                                    onClick={() => i < step && setStep(i)}
                                    disabled={i > step}
                                    className={cn(
                                        'flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all',
                                        isCurrent
                                            ? 'bg-primary/10 border border-primary/30 shadow-2xs'
                                            : isDone
                                            ? 'hover:bg-muted/50 cursor-pointer'
                                            : 'opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                                            isDone
                                                ? 'bg-emerald-600 text-white'
                                                : isCurrent
                                                ? 'bg-primary text-primary-foreground shadow-xs'
                                                : 'bg-muted text-muted-foreground'
                                        )}
                                    >
                                        {isDone ? <Check className="size-3.5" /> : i + 1}
                                    </span>
                                    <div className="min-w-0 hidden sm:block">
                                        <div className={cn('text-xs font-bold truncate', isCurrent ? 'text-primary' : 'text-foreground')}>
                                            {s.title}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground truncate">{s.desc}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </nav>

                {/* Step Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                        {step === 0 && <InfoStep />}
                        {step === 1 && <ItemsStep />}
                        {step === 2 && <ReviewStep />}
                    </motion.div>
                </AnimatePresence>

                {/* Bottom Navigation Buttons */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
                    <button
                        type="button"
                        onClick={() => setStep((s) => Math.max(0, s - 1))}
                        disabled={step === 0 || saving}
                        className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/60 text-xs sm:text-sm font-semibold text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                        <ArrowLeft className="size-4" />
                        <span>Kembali</span>
                    </button>

                    {step < 2 ? (
                        <button
                            type="button"
                            onClick={next}
                            className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
                        >
                            <span>Lanjut</span>
                            <ArrowRight className="size-4" />
                        </button>
                    ) : (
                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={form.handleSubmit((v) => onSubmit(v as CreateFormValues, 'draft'))}
                                className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/60 text-xs sm:text-sm font-semibold text-foreground transition-all shadow-xs active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
                            >
                                <Save className="size-4" />
                                <span>Simpan Draft</span>
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={form.handleSubmit((v) => onSubmit(v as CreateFormValues, 'submit'))}
                                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
                            >
                                <Send className="size-4" />
                                <span>{saving ? 'Mengirim...' : 'Submit Request'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </FormProvider>
    );
}
