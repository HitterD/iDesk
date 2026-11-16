import { useMemo, useState } from 'react';
import { RefreshCw, SlidersHorizontal, Sparkles, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { cn } from '@/lib/utils';
import { useCsiDimensions, useUpdateCsiPeriodQuestions } from '../../hooks/useCsi';
import type { CsiDimension, CsiOption, CsiPeriodDetail, CsiPeriodRateeDimension, CsiScopeParam, UpdateCsiPeriodQuestions } from '../../types';
import { AdminSection, LockedNote, MUTED_TEXT } from './AdminParts';
import { OPTION_PRESETS } from './questions/questionPresets';

const SCORED_TYPES = new Set(['STAR', 'SCALE']);

const TYPE_LABEL: Readonly<Record<string, string>> = {
    STAR: 'Bintang 1–5',
    SCALE: 'Skala 1–5',
    CHOICE: 'Pilihan',
    TEXT: 'Isian',
};

const optionsEqual = (a: readonly CsiOption[], b: readonly CsiOption[]) =>
    a.length === b.length && a.every((item, idx) => item.label === b[idx]?.label && item.points === b[idx]?.points);

/** Collect unique snapshot questions across all ratees, ordered by `sortOrder`. */
export function extractPeriodQuestions(period: CsiPeriodDetail): CsiPeriodRateeDimension[] {
    const byId = new Map<string, CsiPeriodRateeDimension>();
    for (const ratee of period.ratees ?? []) {
        const sorted = [...(ratee.dimensions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
        for (const dim of sorted) {
            if (!byId.has(dim.dimensionId)) {
                byId.set(dim.dimensionId, dim);
            }
        }
    }
    return [...byId.values()];
}

function questionDiffersFromMaster(question: CsiPeriodRateeDimension, master: CsiDimension | undefined, locked: boolean): boolean {
    if (!master) return false;
    if (question.dimensionName !== master.name) return true;
    if ((question.shortLabel ?? null) !== (master.shortLabel ?? null)) return true;
    if (!locked) {
        return question.type !== master.type || question.required !== master.required || !optionsEqual(question.options ?? [], master.options ?? []);
    }
    const bothScored = SCORED_TYPES.has(question.type) && SCORED_TYPES.has(master.type);
    if (!bothScored) return false;
    return question.type !== master.type || (master.type === 'SCALE' && !optionsEqual(question.options ?? [], master.options ?? []));
}

export function countMasterQuestionDiffs(
    questions: readonly CsiPeriodRateeDimension[],
    masters: readonly CsiDimension[],
    locked: boolean,
): number {
    const byId = new Map(masters.map((m) => [m.id, m]));
    return questions.filter((q) => questionDiffersFromMaster(q, byId.get(q.dimensionId), locked)).length;
}

interface PendingAction {
    payload: UpdateCsiPeriodQuestions;
    successMessage: string;
    confirmTitle: string;
    confirmDescription: string;
}

export function PeriodQuestionModes({ scope, period }: { scope: CsiScopeParam; period: CsiPeriodDetail }) {
    const { data: masters = [] } = useCsiDimensions(scope, true);
    const updateMutation = useUpdateCsiPeriodQuestions(scope, period.id);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

    const questions = useMemo(() => extractPeriodQuestions(period), [period]);
    const masterById = useMemo(() => new Map(masters.map((m) => [m.id, m])), [masters]);

    const closed = period.status === 'ENDED' || period.publishStatus === 'CANCELLED';
    const scaleCount = questions.filter((q) => q.type === 'SCALE').length;
    const diffCount = useMemo(
        () => countMasterQuestionDiffs(questions, masters, period.locked),
        [questions, masters, period.locked],
    );

    if (questions.length === 0) return null;

    const executeAction = (action: PendingAction) => {
        updateMutation.mutate(action.payload, {
            onSuccess: () => {
                setPendingAction(null);
                toast.success(action.successMessage);
            },
        });
    };

    const triggerAction = (action: PendingAction) => {
        if (period.locked) {
            setPendingAction(action);
            return;
        }
        executeAction(action);
    };

    const switchQuestionMode = (question: CsiPeriodRateeDimension, nextType: 'STAR' | 'SCALE') => {
        if (question.type === nextType) return;
        const master = masterById.get(question.dimensionId);
        const scaleOptions: CsiOption[] = master?.type === 'SCALE' && master.options?.length
            ? master.options
            : question.options?.length
                ? question.options
                : OPTION_PRESETS.satisfaction.map((o) => ({ ...o }));

        triggerAction({
            payload: {
                updates: [{
                    dimensionId: question.dimensionId,
                    type: nextType,
                    options: nextType === 'SCALE' ? scaleOptions : [],
                }],
            },
            successMessage: `"${question.dimensionName}" diubah ke ${TYPE_LABEL[nextType]}`,
            confirmTitle: `Ubah ke ${TYPE_LABEL[nextType]}?`,
            confirmDescription: `Pertanyaan "${question.dimensionName}" akan diubah menjadi ${TYPE_LABEL[nextType]}. Draf responden yang sedang mengisi akan disesuaikan otomatis.`,
        });
    };

    return (
        <AdminSection
            title="Cara penilaian di survei ini"
            description={closed
                ? 'Survei sudah berakhir atau dibatalkan sehingga cara penilaian tidak dapat diubah lagi.'
                : 'Setiap survei menyimpan salinan pertanyaannya sendiri. Ubah langsung cara penilaian di sini atau terapkan pembaruan dari Pertanyaan master.'}
            actions={period.locked ? <LockedNote /> : undefined}
        >
            {!closed && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={updateMutation.isPending}
                        disabled={diffCount === 0}
                        onClick={() => triggerAction({
                            payload: { syncFromMaster: true },
                            successMessage: 'Pembaruan dari Pertanyaan master diterapkan ke survei ini',
                            confirmTitle: 'Terapkan perubahan dari Pertanyaan master?',
                            confirmDescription: 'Perubahan nama dan cara penilaian Bintang/Skala dari Pertanyaan master akan disalin ke survei ini. Draf responden yang sedang mengisi akan disesuaikan otomatis.',
                        })}
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        Terapkan perubahan dari Pertanyaan master
                        {diffCount > 0 && (
                            <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                                {diffCount}
                            </span>
                        )}
                    </Button>

                    {scaleCount > 0 && (
                        <Button
                            type="button"
                            variant="soft"
                            size="sm"
                            loading={updateMutation.isPending}
                            onClick={() => triggerAction({
                                payload: { convertScaleToStar: true },
                                successMessage: `${scaleCount} pertanyaan Skala diubah menjadi Bintang 1–5`,
                                confirmTitle: 'Ubah semua Skala ke Bintang 1–5?',
                                confirmDescription: `${scaleCount} pertanyaan Skala akan diubah menjadi Bintang 1–5. Responden berikutnya akan melihat bintang 1–5, dan draf yang sedang berjalan akan dikonversi otomatis.`,
                            })}
                        >
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            Ubah semua Skala → Bintang 1–5 ({scaleCount})
                        </Button>
                    )}
                </div>
            )}

            <ul className="divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]" aria-label="Daftar cara penilaian pertanyaan survei">
                {questions.map((question, index) => {
                    const scored = SCORED_TYPES.has(question.type);
                    const changedInMaster = questionDiffersFromMaster(question, masterById.get(question.dimensionId), period.locked);
                    return (
                        <li key={question.dimensionId} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={cn(MUTED_TEXT, 'tabular-nums')}>{index + 1}.</span>
                                    <p className="truncate text-[13.5px] font-medium">{question.dimensionName}</p>
                                    {question.shortLabel && (
                                        <span className="rounded-md bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                                            {question.shortLabel}
                                        </span>
                                    )}
                                    {changedInMaster && (
                                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                            Berubah di master
                                        </span>
                                    )}
                                </div>
                            </div>

                            {scored && !closed ? (
                                <div className="inline-flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.45)] p-0.5" role="group" aria-label={`Mode penilaian ${question.dimensionName}`}>
                                    <button
                                        type="button"
                                        disabled={updateMutation.isPending}
                                        aria-pressed={question.type === 'STAR'}
                                        onClick={() => switchQuestionMode(question, 'STAR')}
                                        className={cn(
                                            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                                            question.type === 'STAR'
                                                ? 'bg-[hsl(var(--background))] text-foreground shadow-sm'
                                                : 'text-[hsl(var(--muted-foreground))] hover:text-foreground',
                                        )}
                                    >
                                        <Star className="h-3 w-3" aria-hidden="true" />
                                        Bintang 1–5
                                    </button>
                                    <button
                                        type="button"
                                        disabled={updateMutation.isPending}
                                        aria-pressed={question.type === 'SCALE'}
                                        onClick={() => switchQuestionMode(question, 'SCALE')}
                                        className={cn(
                                            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                                            question.type === 'SCALE'
                                                ? 'bg-[hsl(var(--background))] text-foreground shadow-sm'
                                                : 'text-[hsl(var(--muted-foreground))] hover:text-foreground',
                                        )}
                                    >
                                        <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
                                        Skala
                                    </button>
                                </div>
                            ) : (
                                <span className="rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                                    {TYPE_LABEL[question.type] ?? question.type}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>

            <ConfirmationDialog
                isOpen={pendingAction !== null}
                appearance="ticket"
                variant="warning"
                title={pendingAction?.confirmTitle ?? ''}
                description={pendingAction?.confirmDescription ?? ''}
                confirmText="Ya, terapkan"
                cancelText="Batal"
                isLoading={updateMutation.isPending}
                onConfirm={() => { if (pendingAction) executeAction(pendingAction); }}
                onCancel={() => setPendingAction(null)}
            />
        </AdminSection>
    );
}
