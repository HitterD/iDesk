import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { ImageOff, Trash2, Upload, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useRemoveCsiSubjectMember, useUpdateCsiPeriodRatee, useUpdateCsiSubject, useUploadCsiSubjectPhoto } from '../../../hooks/useCsi';
import { CSI_PIC_NAME_MIN } from '../../../hcTypes';
import { toneClasses } from '../../../lib/csiTone';
import type { CsiFormRatee, CsiScopeParam, CsiSubjectGroup, CsiSubjectView, UpdateCsiPeriodRatee, UpdateCsiSubject } from '../../../types';
import { FlowChromeContext } from '../../respond/FlowChrome';
import { SubjectPhoto } from '../../respond/SubjectPhoto';
import { FIELD_LABEL, MUTED_TEXT } from '../AdminParts';
import { SUBJECT_KIND_LABEL } from './SubjectCard';
import { TeamDeleteDialog } from './TeamDeleteDialog';

export const CSI_TAGLINE_MAX = 90;
const MB = 1024 * 1024;
export const CSI_PHOTO_MAX_BYTES = 5 * MB;
const PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_SIZE_ERROR = 'Ukuran foto maksimal 5 MB';
export const PHOTO_TYPE_ERROR = 'Format foto harus JPG, PNG, atau WebP';
/** The preview sits outside a survey flow: its title must not compete with the sheet's. */
const PREVIEW_CHROME = { navigated: false, aboveBottomNav: false, headingLevel: 'h2' } as const;

export function photoError(file: File): string | null {
    if (!PHOTO_TYPES.includes(file.type)) return PHOTO_TYPE_ERROR;
    return file.size > CSI_PHOTO_MAX_BYTES ? PHOTO_SIZE_ERROR : null;
}

const orNull = (value: string) => value.trim() || null;
const cleanName = (value: string) => value.replace(/\s+/g, ' ').trim();

/** SubjectPhoto renders a respondent-form ratee; map the master subject onto that shape. */
function toPreviewRatee(subject: CsiSubjectView, siteCode: string, draft: { name: string; jobTitle: string; tagline: string; photoUrl: string | null; serviceFunction?: string }): CsiFormRatee {
    return {
        periodRateeId: subject.key, kind: subject.kind, displayName: draft.name.trim() || subject.name, jobTitle: orNull(draft.jobTitle),
        avatarUrl: draft.photoUrl, photoUrl: draft.photoUrl, siteId: subject.siteId, siteCode, tagline: orNull(draft.tagline), dimensions: [],
        serviceFunction: orNull(draft.serviceFunction ?? subject.serviceFunction ?? ''),
    };
}

interface PickedPhoto { file: File; url: string | null }

/** Local object URL for the preview (jsdom has none); revoked when replaced or on unmount. */
const pickPhoto = (file: File): PickedPhoto => ({ file, url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null });
function useRevokeOnChange(photo: PickedPhoto | null) {
    useEffect(() => () => { if (photo?.url) URL.revokeObjectURL(photo.url); }, [photo]);
}

function PhotoDropzone({ fileName, error, onPick }: { fileName: string | null; error: string | null; onPick: (file: File) => void }) {
    const input = useRef<HTMLInputElement>(null);
    const [over, setOver] = useState(false);
    const errorId = useId();
    const pickFirst = (files: FileList | null) => { const file = files?.[0]; if (file) onPick(file); };
    const drop = (event: DragEvent) => { event.preventDefault(); setOver(false); pickFirst(event.dataTransfer.files); };
    return (
        <div className="grid gap-1.5">
            <button type="button" onClick={() => input.current?.click()} aria-describedby={error ? errorId : undefined}
                onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
                className={cn('grid place-items-center rounded-2xl border-2 border-dashed border-[hsl(var(--idesk-border))] bg-[hsl(var(--muted)/.5)] p-5 text-center text-[hsl(var(--idesk-text-secondary))] transition-colors duration-200',
                    'hover:border-[hsl(var(--ticket-teal))] hover:text-[hsl(var(--ticket-teal-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    over && 'border-[hsl(var(--ticket-teal))] text-[hsl(var(--ticket-teal-ink))]')}>
                <Upload className="h-7 w-7" aria-hidden="true" />
                <span className="mt-1.5 text-[13.5px]"><b>Tarik foto ke sini</b> atau klik untuk pilih</span>
                <span className="text-[12px]">{fileName ?? 'JPG/PNG/WebP ≤ 5 MB · potret 4:5, wajah di sepertiga atas'}</span>
            </button>
            <input ref={input} type="file" accept={PHOTO_TYPES.join(',')} aria-label="Pilih foto" tabIndex={-1} className="sr-only"
                onChange={(event) => { pickFirst(event.target.files); event.target.value = ''; }} />
            {error && <p id={errorId} role="alert" className={cn('text-[12.5px] font-medium', toneClasses('red').ink)}>{error}</p>}
        </div>
    );
}

function TextField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="grid gap-1.5">
            <label htmlFor={id} className={FIELD_LABEL}>{label}</label>
            <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}

function EditForm({ scope, subject, group, onClose }: { scope: CsiScopeParam; subject: CsiSubjectView; group: CsiSubjectGroup; onClose: () => void }) {
    const update = useUpdateCsiSubject(scope);
    const upload = useUploadCsiSubjectPhoto(scope);
    const remove = useRemoveCsiSubjectMember(scope);
    const [draft, setDraft] = useState({ name: subject.name, jobTitle: subject.jobTitle ?? '', tagline: subject.tagline ?? '', serviceFunction: subject.serviceFunction ?? '' });
    const [photo, setPhoto] = useState<PickedPhoto | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    useRevokeOnChange(photo);
    const file = photo?.file ?? null;
    const isTeam = subject.kind === 'TEAM';
    /** HC PIC masters are renamed here too (same rename as PIC HC and the template card). */
    const isPic = !!subject.picId;
    const editsName = isTeam || isPic;
    const hasServiceFunction = !isTeam && scope === 'ict';
    /** Team delete is HC-only (the backend endpoint refuses ICT). */
    const canDeleteTeam = isTeam && !!subject.teamId && scope === 'hc';
    const ids = { jobTitle: useId(), name: useId(), serviceFunction: useId() };
    const set = (field: keyof typeof draft) => (value: string) => setDraft((prev) => ({ ...prev, [field]: value }));
    const pick = (next: File) => { const error = photoError(next); setFileError(error); setPhoto(error ? null : pickPhoto(next)); };

    const save = () => {
        const payload: UpdateCsiSubject = {
            tagline: orNull(draft.tagline), jobTitle: orNull(draft.jobTitle),
            ...(isTeam ? { name: draft.name.trim() } : {}),
            ...(isPic && cleanName(draft.name) !== cleanName(subject.name) ? { name: cleanName(draft.name) } : {}),
            ...(hasServiceFunction ? { serviceFunction: orNull(draft.serviceFunction) } : {}),
        };
        const saveText = () => update.mutate({ key: subject.key, payload }, { onSuccess: onClose });
        if (file) upload.mutate({ key: subject.key, file }, { onSuccess: saveText });
        else saveText();
    };
    const pending = update.isPending || upload.isPending;
    const preview = toPreviewRatee(subject, group.siteCode, { ...draft, photoUrl: photo?.url ?? subject.photoUrl });

    return (
        <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
                <FlowChromeContext.Provider value={PREVIEW_CHROME}>
                    <div aria-label="Pratinjau" role="group" className="@container overflow-hidden rounded-2xl">
                        <SubjectPhoto ratee={preview} index={0} total={1} />
                    </div>
                </FlowChromeContext.Provider>
                <PhotoDropzone fileName={file?.name ?? null} error={fileError} onPick={pick} />
                <TaglineField value={draft.tagline} onChange={set('tagline')} />
                <TextField id={ids.jobTitle} label="Jabatan yang ditampilkan" value={draft.jobTitle} onChange={set('jobTitle')} />
                {/* ICT people only: HC people get their fungsi pelayanan from the PIC master (Pengaturan → PIC HC). */}
                {hasServiceFunction && <TextField id={ids.serviceFunction} label="Fungsi pelayanan" value={draft.serviceFunction} onChange={set('serviceFunction')} />}
                {editsName && <TextField id={ids.name} label={isTeam ? 'Nama tim' : 'Nama'} value={draft.name} onChange={set('name')} />}
                {isPic && <p className={MUTED_TEXT}>Nama ikut berubah di template penugasan, PIC HC dan survei yang belum berjalan.</p>}
            </div>
            <SheetFooter onClose={onClose} onSave={save} pending={pending} disabled={(isTeam && !draft.name.trim()) || (isPic && cleanName(draft.name).length < CSI_PIC_NAME_MIN)}
                extra={canDeleteTeam ? (
                    <Button variant="subtle" className="mr-auto text-[hsl(var(--ticket-red-ink))]" disabled={pending} onClick={() => setDeleting(true)}>
                        <Trash2 aria-hidden="true" />Hapus tim
                    </Button>
                ) : !isTeam && subject.userId && scope === 'hc' ? (
                    <Button variant="subtle" className="mr-auto text-[hsl(var(--ticket-red-ink))]" loading={remove.isPending}
                        onClick={() => remove.mutate(subject.userId!, { onSuccess: onClose })}>
                        <UserMinus aria-hidden="true" />Keluarkan dari daftar
                    </Button>
                ) : null} />
            {canDeleteTeam && (
                <TeamDeleteDialog scope={scope} team={deleting ? { teamId: subject.teamId!, name: subject.name } : null}
                    onClose={() => setDeleting(false)} onDeleted={onClose} />
            )}
        </>
    );
}

function SheetFooter({ onClose, onSave, pending, disabled, extra }: {
    onClose: () => void; onSave: () => void; pending: boolean; disabled?: boolean; extra?: ReactNode;
}) {
    return (
        <div className="flex justify-end gap-2 border-t border-[hsl(var(--idesk-border)/.7)] px-6 py-4">
            {extra}
            <Button variant="subtle" onClick={onClose}>Batal</Button>
            <Button variant="primary" onClick={onSave} loading={pending} disabled={disabled}>Simpan</Button>
        </div>
    );
}

function TaglineField({ value, onChange, hint }: { value: string; onChange: (value: string) => void; hint?: string }) {
    const id = useId();
    return (
        <div className="grid gap-1.5">
            <label htmlFor={id} className={FIELD_LABEL}>Tagline / caption (tampil persis di bawah foto)</label>
            <Textarea id={id} rows={2} maxLength={CSI_TAGLINE_MAX} value={value} placeholder={hint} onChange={(event) => onChange(event.target.value)} />
            <span className={cn(MUTED_TEXT, 'justify-self-end text-[12px] tabular-nums')}>{`${value.length}/${CSI_TAGLINE_MAX}`}</span>
        </div>
    );
}

/** Period mode: tagline override and "Pakai foto master" only (no upload); saved on the period ratee. */
function PeriodEditForm({ scope, periodId, target, onClose }: { scope: CsiScopeParam; periodId: string; target: SubjectEditTarget; onClose: () => void }) {
    const update = useUpdateCsiPeriodRatee(scope, periodId);
    const { subject, group } = target;
    const [tagline, setTagline] = useState(subject.tagline ?? '');
    const [resetPhoto, setResetPhoto] = useState(false);
    const save = () => {
        const payload: UpdateCsiPeriodRatee = { tagline: orNull(tagline), ...(resetPhoto ? { photoUrl: null } : {}) };
        update.mutate({ periodRateeId: subject.key, payload }, { onSuccess: onClose });
    };
    const preview = toPreviewRatee(subject, group.siteCode, { name: subject.name, jobTitle: subject.jobTitle ?? '', tagline, photoUrl: resetPhoto ? null : subject.photoUrl });
    return (
        <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
                <FlowChromeContext.Provider value={PREVIEW_CHROME}>
                    <div aria-label="Pratinjau" role="group" className="@container overflow-hidden rounded-2xl">
                        <SubjectPhoto ratee={preview} index={0} total={1} />
                    </div>
                </FlowChromeContext.Provider>
                {target.photoOverride && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="soft" onClick={() => setResetPhoto(true)} disabled={resetPhoto}><ImageOff aria-hidden="true" />Pakai foto master</Button>
                        {resetPhoto && <span role="status" className={MUTED_TEXT}>Foto master dipakai setelah disimpan.</span>}
                    </div>
                )}
                <TaglineField value={tagline} onChange={setTagline} hint="Kosong = pakai tagline master" />
                <p className={MUTED_TEXT}>Hanya berlaku untuk periode ini; master data tidak berubah. Foto diubah di tab Subjek &amp; foto.</p>
            </div>
            <SheetFooter onClose={onClose} onSave={save} pending={update.isPending} />
        </>
    );
}

export interface SubjectEditTarget {
    subject: CsiSubjectView;
    group: CsiSubjectGroup;
    /** Period mode: the ratee has its own photo for this period ("Pakai foto master" resets it). */
    photoOverride?: boolean;
}

type SubjectEditSheetProps = { scope: CsiScopeParam; scopeLabel: string; target: SubjectEditTarget | null; onClose: () => void }
    & ({ mode?: 'master' } | { mode: 'period'; periodId: string });

/** `master` edits the scope's subject master; `period` edits one period ratee (`subject.key` = periodRateeId). */
export function SubjectEditSheet(props: SubjectEditSheetProps) {
    const { scope, scopeLabel, target, onClose } = props;
    const isPeriod = props.mode === 'period';
    const description = target ? [SUBJECT_KIND_LABEL[target.subject.kind], `${scopeLabel} ${target.group.siteName}`, isPeriod ? 'Khusus periode ini' : null].filter(Boolean).join(' · ') : '';
    return (
        <Sheet open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
            <SheetContent side="right" className="max-w-lg">
                <SheetHeader className="pr-12">
                    <SheetTitle>{isPeriod ? `Tampilan ${target?.subject.name ?? ''} untuk periode ini` : 'Edit subjek'}</SheetTitle>
                    <SheetDescription>{description}</SheetDescription>
                </SheetHeader>
                {target && (props.mode === 'period'
                    ? <PeriodEditForm key={target.subject.key} scope={scope} periodId={props.periodId} target={target} onClose={onClose} />
                    : <EditForm key={target.subject.key} scope={scope} subject={target.subject} group={target.group} onClose={onClose} />)}
            </SheetContent>
        </Sheet>
    );
}
