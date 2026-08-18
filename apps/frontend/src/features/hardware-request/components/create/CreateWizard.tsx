import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { InfoStep } from './InfoStep';
import { ItemsStep } from './ItemsStep';
import { ReviewStep } from './ReviewStep';
import { HardwareRequestApi } from '../../api/hardware-request.api';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';

const schema = z.object({
    siteId: z.string().uuid(),
    division: z.string().optional(),
    recipientName: z.string().optional(),
    justification: z.string().min(1, 'Justifikasi wajib diisi'),
    items: z.array(z.object({
        catalogId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        specs: z.record(z.string(), z.unknown()).optional(),
        recipientName: z.string().optional(),
    })).min(1, 'Minimal 1 item'),
});
export type CreateFormValues = z.infer<typeof schema>;

const STEPS = ['Info', 'Items', 'Review'] as const;

export function CreateWizard() {
    const nav = useNavigate();
    const basePath = useHardwareBasePath();
    const [step, setStep] = useState(0);
    const form = useForm<CreateFormValues>({
        resolver: zodResolver(schema),
        defaultValues: { siteId: '', justification: '', items: [], recipientName: '', division: '' },
        mode: 'onBlur',
    });
    const [saving, setSaving] = useState(false);

    const onSubmit = async (values: CreateFormValues, action: 'draft' | 'submit') => {
        try {
            setSaving(true);
            const payload = {
                ...values,
                items: values.items.map(i => ({
                    catalogId: i.catalogId,
                    quantity: i.quantity,
                    customFields: { ...i.specs, recipientName: i.recipientName }
                }))
            };
            const req = await HardwareRequestApi.create(payload);
            if (action === 'submit') await HardwareRequestApi.submit(req.id);
            toast.success(action === 'submit' ? 'Request disubmit' : 'Draft disimpan');
            nav(`${basePath}/${req.id}`);
        } catch (e: any) {
            toast.error(e?.message ?? 'Gagal');
        } finally { setSaving(false); }
    };

    const next = async () => {
        const fields: (keyof CreateFormValues)[] = step === 0 ? ['siteId', 'justification'] : step === 1 ? ['items'] : [];
        const ok = await form.trigger(fields);
        if (ok) setStep(s => Math.min(2, s + 1));
    };

    return (
        <FormProvider {...form}>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold tracking-tight dark:text-white">Request Hardware</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Isi info, pilih item, lalu submit.</p>
                </header>
                <nav aria-label="Wizard" className="flex items-center gap-0">
                    {STEPS.map((label, i) => (
                        <div key={label} className="flex items-center gap-2 flex-1">
                            <button
                                type="button"
                                onClick={() => i < step && setStep(i)}
                                className={`flex items-center gap-2 ${i < step ? 'cursor-pointer' : 'cursor-default'}`}
                                aria-current={i === step ? 'step' : undefined}>
                                <span className={`size-7 rounded-full grid place-items-center text-xs font-semibold ring-2 transition-all duration-200
                                    ${i < step ? 'bg-emerald-600 text-white ring-emerald-600'
                                    : i === step ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 ring-slate-900 dark:ring-white'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-500 ring-slate-200 dark:ring-slate-700'}`}>{i + 1}</span>
                                <span className={`text-xs font-medium ${i <= step ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>{label}</span>
                            </button>
                            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                        </div>
                    ))}
                </nav>
                <AnimatePresence mode="wait">
                    <motion.div key={step}
                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}>
                        {step === 0 && <InfoStep />}
                        {step === 1 && <ItemsStep />}
                        {step === 2 && <ReviewStep />}
                    </motion.div>
                </AnimatePresence>
                <div className="flex justify-between gap-3 pt-2">
                    <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
                        className="px-4 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-slate-300 disabled:opacity-40 transition-all duration-200">Back</button>
                    {step < 2 ? (
                        <button type="button" onClick={next}
                            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium hover:opacity-90 transition-all duration-200">Next</button>
                    ) : (
                        <div className="flex gap-2">
                            <button type="button" disabled={saving} onClick={form.handleSubmit(v => onSubmit(v, 'draft'))}
                                className="px-4 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-slate-300 transition-all duration-200">Save as Draft</button>
                            <button type="button" disabled={saving} onClick={form.handleSubmit(v => onSubmit(v, 'submit'))}
                                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium hover:opacity-90 transition-all duration-200">Submit</button>
                        </div>
                    )}
                </div>
            </div>
        </FormProvider>
    );
}
