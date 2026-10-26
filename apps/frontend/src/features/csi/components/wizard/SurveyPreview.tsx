import { Eye } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { CsiPeriodDetail } from '../../types';
import { EmptyNote } from '../admin/AdminParts';
import { WIZARD_COPY } from './wizardCopy';

interface SurveyPreviewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    period: CsiPeriodDetail;
}

/** Respondent form preview (nothing is submitted). The real respondent flow is wired in later. */
export function SurveyPreview({ open, onOpenChange, period }: SurveyPreviewProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="max-w-xl">
                <SheetHeader className="pr-12">
                    <SheetTitle>{WIZARD_COPY.previewTitle}</SheetTitle>
                    <SheetDescription>{period.title}</SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
                    <p role="note" className="mb-4 flex items-center gap-2 rounded-2xl bg-[hsl(var(--ticket-amber)/.12)] px-4 py-2.5 text-[13px] font-medium text-[hsl(var(--ticket-amber-ink))]">
                        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />{WIZARD_COPY.previewBanner}
                    </p>
                    <EmptyNote>{WIZARD_COPY.previewPlaceholder}</EmptyNote>
                </div>
            </SheetContent>
        </Sheet>
    );
}
