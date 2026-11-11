import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccountSuggestions, useSetRaterAccount } from '../../../../hooks/useCsiHc';
import type { CsiTemplate, CsiTemplateRaterStatus } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';
import { titleCase } from '../hcFormat';
import { RATER_STATUS } from './RaterRow';
import { suggestionDetail } from './AccountCombobox';
import { RaterAccountPicker } from './RaterAccountPicker';

const NEEDS_CHECK: ReadonlySet<CsiTemplateRaterStatus> = new Set(['ambiguous', 'no-account']);

interface Issue { key: string; name: string; status: CsiTemplateRaterStatus; raterIds: string[]; picCount: number }

/** The same person typed in several cards is one decision: group by normalised name. */
const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toUpperCase();

export function collectIssues(template: CsiTemplate): Issue[] {
    const byName = new Map<string, Issue & { pics: Set<string> }>();
    for (const pic of template.pics) {
        for (const rater of pic.raters) {
            if (!NEEDS_CHECK.has(rater.status)) continue;
            const key = nameKey(rater.raterName);
            const issue = byName.get(key) ?? { key, name: rater.raterName, status: rater.status, raterIds: [], picCount: 0, pics: new Set<string>() };
            issue.raterIds.push(rater.id);
            issue.pics.add(pic.id);
            byName.set(key, issue);
        }
    }
    return [...byName.values()].map(({ pics, ...issue }) => ({ ...issue, picCount: pics.size }));
}

function IssueRow({ scope, templateId, issue, onDismiss }: { scope: CsiScopeParam; templateId: string; issue: Issue; onDismiss: () => void }) {
    const suggestions = useAccountSuggestions(scope, templateId, issue.name);
    const setAccount = useSetRaterAccount(scope);
    const top = suggestions.data?.[0];
    const name = titleCase(issue.name);
    return (
        <li aria-label={name} className="flex flex-wrap items-center gap-2 rounded-xl bg-[hsl(var(--idesk-surface))] px-3 py-2 text-[12.5px]">
            <div className="min-w-0 flex-1">
                <p className="font-semibold">{name} <span className="font-normal text-muted-foreground">{`· ${RATER_STATUS[issue.status].label} · ${issue.picCount} PIC`}</span></p>
                <p className="text-[12px] text-muted-foreground">
                    {suggestions.isLoading ? 'Mencari saran akun…' : top ? `Saran: ${top.fullName} (${suggestionDetail(top)})` : 'Tidak ada saran akun'}
                </p>
            </div>
            <Button variant="soft" size="sm" disabled={!top || setAccount.isPending}
                onClick={() => top && setAccount.mutate({ raterIds: issue.raterIds, userId: top.id })}>Terima</Button>
            <RaterAccountPicker scope={scope} templateId={templateId} raterIds={issue.raterIds} initialName={issue.name}
                userId={null} confirmed={false} label={`Akun untuk ${name}`}
                trigger={<Button variant="subtle" size="sm">Pilih lain</Button>} />
            <Button variant="subtle" size="sm" onClick={onDismiss} title="Sembunyikan sampai halaman dimuat ulang">Biarkan</Button>
        </li>
    );
}

/**
 * "N perlu dicek": rater names that are ambiguous or have no account, one decision per unique name.
 * Each needs an explicit choice; there is deliberately no "accept all" because a wrong pin hands a
 * survey to the wrong person. Suggestions load only once the panel is opened.
 */
export function TemplateIssuesPanel({ scope, template }: { scope: CsiScopeParam; template: CsiTemplate }) {
    const [open, setOpen] = useState(false);
    const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
    const issues = useMemo(() => collectIssues(template).filter((issue) => !dismissed.has(issue.key)), [template, dismissed]);
    if (!issues.length) return null;
    const title = `${issues.length} perlu dicek`;
    return (
        <section aria-label={title} className="grid gap-2 rounded-2xl bg-[hsl(var(--ticket-amber)/.1)] p-3 ring-1 ring-[hsl(var(--ticket-amber)/.3)]">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--ticket-amber-ink))]" aria-hidden="true" />
                <p className="flex-1 text-[13.5px] font-bold">{title}</p>
                <Button variant="subtle" size="sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'Tutup' : 'Lihat'}</Button>
            </div>
            {open && (
                <ul className="grid max-h-80 gap-1.5 overflow-auto">
                    {issues.map((issue) => (
                        <IssueRow key={issue.key} scope={scope} templateId={template.id} issue={issue}
                            onDismiss={() => setDismissed((prev) => new Set(prev).add(issue.key))} />
                    ))}
                </ul>
            )}
        </section>
    );
}
