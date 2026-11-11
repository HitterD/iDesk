import { useState } from 'react';
import { Camera, PenLine, User, Users } from 'lucide-react';
import { TicketPill } from '@/components/ui/ticket-pill';
import { cn } from '@/lib/utils';
import { siteTone, toneClasses } from '../../../lib/csiTone';
import type { CsiSubjectView } from '../../../types';
import { imageUrl } from '../../respond/RateeAvatar';
import { MUTED_TEXT } from '../AdminParts';

export const SUBJECT_KIND_LABEL = { TEAM: 'Tim', PERSON: 'Individu' } as const;

/** 4:3 photo, or the site colour with the initial when there is none (or it fails to load). */
function CardPhoto({ subject, siteCode }: { subject: CsiSubjectView; siteCode: string }) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const url = subject.photoUrl;
    if (url && failedUrl !== url) {
        return <img src={imageUrl(url)} alt="" loading="lazy" className="h-full w-full object-cover object-[center_25%]" onError={() => setFailedUrl(url)} />;
    }
    return (
        <span aria-hidden="true" className={cn('grid h-full w-full place-items-center text-[56px] font-bold text-white/90', toneClasses(siteTone(siteCode)).fill)}>
            {subject.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
    );
}

/** HC extras under the name: custom team layanan + member count, or a PIC that has no iDesk account yet. */
function HcChips({ subject }: { subject: CsiSubjectView }) {
    if (subject.teamKind === 'CUSTOM') {
        return (
            <span className="flex flex-wrap items-center gap-1.5 pt-1">
                {subject.serviceCode && <TicketPill tone="neutral">{subject.serviceCode}</TicketPill>}
                <span className={cn(MUTED_TEXT, 'text-[12px]')}>{`${subject.members?.length ?? 0} anggota`}</span>
            </span>
        );
    }
    if (subject.picId && !subject.hasAccount) {
        return <span className="pt-1"><TicketPill tone="amber">Belum punya akun</TicketPill></span>;
    }
    return null;
}

export function SubjectCard({ subject, siteCode, onEdit }: { subject: CsiSubjectView; siteCode: string; onEdit: () => void }) {
    const KindIcon = subject.kind === 'TEAM' ? Users : User;
    return (
        <button type="button" onClick={onEdit} aria-label={`Ubah ${subject.name}`}
            className="group flex h-full flex-col overflow-hidden rounded-[18px] bg-[hsl(var(--idesk-surface))] text-left shadow-[var(--dash-shadow-1)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--dash-shadow-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0">
            <div className="relative aspect-[4/3] w-full shrink-0 bg-[hsl(var(--muted))]">
                <CardPhoto subject={subject} siteCode={siteCode} />
                <TicketPill tone={subject.kind === 'TEAM' ? 'amber' : 'neutral'} className="absolute left-2.5 top-2.5 inline-flex items-center gap-1">
                    <KindIcon className="h-3.5 w-3.5" aria-hidden="true" />{SUBJECT_KIND_LABEL[subject.kind]}
                </TicketPill>
                <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-[rgb(10_20_45/.45)] font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="inline-flex items-center gap-1.5"><Camera className="h-4 w-4" />Ganti foto &amp; tagline</span>
                </span>
            </div>
            <div className="flex flex-1 flex-col gap-0.5 px-3.5 py-3">
                <span className="line-clamp-2 font-semibold leading-tight">{subject.name}</span>
                {subject.jobTitle && <span className={cn(MUTED_TEXT, 'text-[12px]')}>{subject.jobTitle}</span>}
                <HcChips subject={subject} />
                {subject.tagline
                    ? <span className="mt-auto pt-2.5 text-[12.5px] italic">“{subject.tagline}”</span>
                    : (
                        <span className={cn('mt-auto inline-flex items-center gap-1.5 pt-2.5 text-[12.5px] font-semibold', toneClasses('amber').ink)}>
                            <PenLine className="h-3.5 w-3.5" aria-hidden="true" />Tambah tagline
                        </span>
                    )}
            </div>
        </button>
    );
}
