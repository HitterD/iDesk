import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useApplyCsiTemplate } from '../../../hooks/useCsi';
import { matchTemplateDimensions, templateLabel } from '../../../lib/csiTemplateQuestions';
import { sameOrder } from '../../../lib/teamQuestions';
import type { CsiDimension, CsiScopeParam } from '../../../types';

interface TemplateApplyButtonProps {
    scope: CsiScopeParam;
    questions: readonly CsiDimension[];
    value: readonly string[];
    disabled?: boolean;
    onApply: (ids: string[]) => void;
}

/**
 * One-click preset that selects canonical template questions in template order,
 * auto-seeding any missing master template questions first when needed.
 */
export function TemplateApplyButton({ scope, questions, value, disabled, onApply }: TemplateApplyButtonProps) {
    const apply = useApplyCsiTemplate(scope);
    const label = templateLabel(scope);
    const matched = matchTemplateDimensions(scope, questions);
    const active = matched.missingCount === 0 && matched.ids.length > 0 && sameOrder(matched.ids, value);

    const handleClick = async () => {
        if (matched.missingCount === 0) {
            onApply(matched.ids);
            return;
        }
        const created = await apply.mutateAsync(undefined);
        const byId = new Map<string, CsiDimension>();
        questions.forEach((question) => byId.set(question.id, question));
        created.forEach((question) => byId.set(question.id, question));
        const next = matchTemplateDimensions(scope, [...byId.values()]);
        if (created.length) toast.success(`${created.length} pertanyaan ${label} ditambahkan & dipilih`);
        if (next.ids.length) onApply(next.ids);
    };

    return (
        <Button type="button" size="sm" variant={active ? 'primary' : 'soft'} aria-pressed={active}
            disabled={disabled} loading={apply.isPending} onClick={handleClick}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
        </Button>
    );
}
