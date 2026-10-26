import { Eye } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/stores/useAuth';
import { useCsiDepartments, useCsiDimensions } from '../../hooks/useCsi';
import { toPreviewForm } from '../../lib/wizard';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { SurveyFlow } from '../respond/SurveyFlow';
import { EmptyNote } from '../admin/AdminParts';
import { WIZARD_COPY } from './wizardCopy';

interface SurveyPreviewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    period: CsiPeriodDetail;
}

/** Respondent flow embedded in a sheet; preview answers stay in memory only. */
export function SurveyPreview({ open, onOpenChange, period }: SurveyPreviewProps) {
    const { user } = useAuth();
    const scope = period.scope.toLowerCase() as CsiScopeParam;
    const { data: departments = [] } = useCsiDepartments(scope);
    const { data: dimensions = [] } = useCsiDimensions(scope, true);
    const form = toPreviewForm(period, departments, dimensions, user?.fullName ?? '');
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="max-w-3xl">
                <SheetHeader className="pr-12">
                    <SheetTitle>{WIZARD_COPY.previewTitle}</SheetTitle>
                    <SheetDescription>{period.title}</SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 [--flow-gutter:0.875rem] pb-6">
                    <p role="note" className="mb-4 flex items-center gap-2 rounded-2xl bg-[hsl(var(--ticket-amber)/.12)] px-4 py-2.5 text-[13px] font-medium text-[hsl(var(--ticket-amber-ink))]">
                        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />{WIZARD_COPY.previewBanner}
                    </p>
                    {form.ratees.length === 0 ? (
                        <EmptyNote>Tambahkan orang yang dinilai untuk melihat pratinjau.</EmptyNote>
                    ) : (
                        <SurveyFlow key={period.id} form={form} userId={user?.id ?? ''} mode="preview" headingLevel="h2" />
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
