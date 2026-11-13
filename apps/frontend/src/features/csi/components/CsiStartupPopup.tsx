import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { TicketPill } from '@/components/ui/ticket-pill';
import { useAuth } from '@/stores/useAuth';
import { useCsiActive } from '../hooks/useCsi';
import { formatDate } from '../lib/format';
import { hasDraft } from '../lib/surveyDraft';
import { useCsiBasePath } from '../lib/useCsiBasePath';
import type { CsiActivePeriod } from '../types';

export const CSI_POPUP_DISMISSED_KEY_PREFIX = 'csi_popup_dismissed';

const dismissedKey = (userId: string) => `${CSI_POPUP_DISMISSED_KEY_PREFIX}:${userId}`;

function readDismissedIds(userId: string): Set<string> {
    try {
        const raw = sessionStorage.getItem(dismissedKey(userId));
        if (!raw) return new Set();
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === 'string')) : new Set();
    } catch {
        return new Set();
    }
}

function writeDismissedIds(userId: string, ids: ReadonlySet<string>): void {
    try {
        sessionStorage.setItem(dismissedKey(userId), JSON.stringify([...ids]));
    } catch {
        // Storage unavailable (private mode/quota): in-memory state still keeps it dismissed this render.
    }
}

function ctaLabel(userId: string, surveyId: string, single: boolean): string {
    if (hasDraft(userId, surveyId)) return 'Lanjutkan';
    return single ? 'Isi Survei CSI' : 'Isi';
}

function SurveyOptionRow({ survey, userId, single, onOpen }: {
    survey: CsiActivePeriod; userId: string; single: boolean; onOpen: () => void;
}) {
    const intro = survey.intro?.trim();
    return (
        <div className="space-y-2.5 rounded-xl border border-border/70 bg-muted/35 p-3.5">
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <TicketPill tone={survey.scope === 'HC' ? 'teal' : 'blue'}>{survey.scope}</TicketPill>
                        {survey.endDate && (
                            <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                                <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                                s.d. {formatDate(survey.endDate)}
                            </span>
                        )}
                    </div>
                    <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground">{survey.title}</p>
                </div>
                <Button type="button" variant="primary" size={single ? 'default' : 'sm'} className="shrink-0" onClick={onOpen}>
                    {ctaLabel(userId, survey.id, single)}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>
            {intro && (
                <p className="whitespace-pre-line border-t border-border/50 pt-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    {intro}
                </p>
            )}
        </div>
    );
}

/**
 * Initial prompt shown once per session when the signed-in user has active, unfilled CSI surveys.
 * Dismissing with X remembers seen period IDs for the session; filled surveys never reappear, and newly opened periods prompt again.
 */
export function CsiStartupPopup() {
    const { user } = useAuth();
    const { data } = useCsiActive();
    const basePath = useCsiBasePath();
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const userId = user?.id ?? '';
    const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(() => (userId ? readDismissedIds(userId) : new Set()));

    useEffect(() => {
        setDismissedIds(userId ? readDismissedIds(userId) : new Set());
    }, [userId]);

    const pending = Array.isArray(data) ? data.filter((survey) => !survey.submitted) : [];
    const onCsiRoute = pathname === basePath || pathname.startsWith(`${basePath}/`);
    const unseen = pending.filter((survey) => !dismissedIds.has(survey.id));
    const open = Boolean(userId && !onCsiRoute && unseen.length > 0);

    const handleDismiss = () => {
        if (!userId || pending.length === 0) return;
        const next = new Set(readDismissedIds(userId));
        for (const survey of pending) next.add(survey.id);
        writeDismissedIds(userId, next);
        setDismissedIds(next);
    };

    const handleOpenSurvey = (target: string) => {
        handleDismiss();
        navigate(target);
    };

    if (!open) return null;

    const single = pending.length === 1;
    return (
        <Dialog open onOpenChange={(isOpen) => { if (!isOpen) handleDismiss(); }}>
            <DialogContent className="w-[92vw] max-w-[540px] gap-4 p-6">
                <div className="flex items-start gap-3.5 pr-6">
                    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500">
                        <Star className="h-5 w-5 fill-current" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-base font-bold leading-snug text-foreground">
                            {single ? 'Ada Survei CSI untuk Anda' : `${pending.length} Survei CSI Belum Diisi`}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                            Luangkan sebentar untuk memberikan penilaian layanan agar pelayanan kami semakin baik.
                        </DialogDescription>
                    </div>
                </div>

                <div className="grid max-h-[55vh] gap-2.5 overflow-y-auto">
                    {pending.map((survey) => (
                        <SurveyOptionRow
                            key={survey.id}
                            survey={survey}
                            userId={userId}
                            single={single}
                            onOpen={() => handleOpenSurvey(`${basePath}/${encodeURIComponent(survey.id)}`)}
                        />
                    ))}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    {!single && (
                        <Button type="button" variant="outline" size="sm" onClick={() => handleOpenSurvey(basePath)}>
                            Lihat Daftar Survei CSI
                        </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={handleDismiss}>
                        Nanti saja
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default CsiStartupPopup;
