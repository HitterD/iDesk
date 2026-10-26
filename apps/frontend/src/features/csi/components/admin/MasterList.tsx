import { useState, type FormEvent } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TicketPill } from '@/components/ui/ticket-pill';
import { cn } from '@/lib/utils';
import { CSI_DESCRIPTION_MAX, CSI_NAME_MAX } from '../../lib/csiAdmin';
import { ADMIN_PANEL, CreateButton, EmptyNote, FIELD_LABEL, MUTED_TEXT } from './AdminParts';

export interface MasterItem {
    id: string;
    name: string;
    isActive: boolean;
    sortOrder: number;
    description?: string | null;
}

export interface MasterPayload {
    name: string;
    sortOrder: number;
    isActive?: boolean;
    description?: string | null;
}

interface MasterListProps {
    /** Singular noun, e.g. "dimensi". */
    noun: string;
    items: readonly MasterItem[] | undefined;
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
    withDescription?: boolean;
    showInactive: boolean;
    onShowInactiveChange: (value: boolean) => void;
    /** Wizard use: hides the "Tampilkan nonaktif" switch and uses a soft add button (the page keeps one amber CTA). */
    compact?: boolean;
    onCreate: (payload: MasterPayload, done: () => void) => void;
    onUpdate: (id: string, payload: MasterPayload, done: () => void) => void;
    onDeactivate: (id: string, done: () => void) => void;
    pending: boolean;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** Active first, then the admin's order, then name. */
const byActiveOrder = (a: MasterItem, b: MasterItem) =>
    Number(b.isActive) - Number(a.isActive) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'id');

function MasterDialog({ noun, item, withDescription, pending, onClose, onSubmit }: {
    noun: string; item: MasterItem | null; withDescription?: boolean; pending: boolean;
    onClose: () => void; onSubmit: (payload: MasterPayload) => void;
}) {
    const [name, setName] = useState(item?.name ?? '');
    const [description, setDescription] = useState(item?.description ?? '');
    const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
    const [isActive, setIsActive] = useState(item?.isActive ?? true);
    const order = Number.parseInt(sortOrder, 10);
    const valid = !!name.trim() && Number.isInteger(order);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!valid) return;
        onSubmit({
            name: name.trim(), sortOrder: order,
            ...(withDescription ? { description: description.trim() || null } : {}),
            ...(item ? { isActive } : {}),
        });
    };
    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{item ? `Ubah ${noun}` : `Tambah ${noun}`}</DialogTitle>
                <DialogDescription>{`Urutan menentukan posisi ${noun} di form survei.`}</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="grid gap-4">
                <label className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Nama</span>
                    <Input value={name} maxLength={CSI_NAME_MAX} onChange={(event) => setName(event.target.value)} required autoFocus />
                </label>
                {withDescription && (
                    <label className="grid gap-1.5">
                        <span className={FIELD_LABEL}>Deskripsi (opsional)</span>
                        <Textarea value={description} maxLength={CSI_DESCRIPTION_MAX} rows={3} onChange={(event) => setDescription(event.target.value)} />
                    </label>
                )}
                <label className="grid gap-1.5 sm:max-w-[160px]">
                    <span className={FIELD_LABEL}>Urutan</span>
                    <Input type="number" inputMode="numeric" step={1} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} required />
                </label>
                {item && (
                    <label className="flex items-center gap-3">
                        <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Aktif" />
                        <span className="text-[13.5px]">Aktif</span>
                    </label>
                )}
                <DialogFooter className="gap-2 sm:space-x-0">
                    <Button type="button" variant="soft" onClick={onClose} disabled={pending}>Batal</Button>
                    <Button type="submit" variant="primary" loading={pending} disabled={!valid}>Simpan</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
}

export function MasterList(props: MasterListProps) {
    const { noun, items, isLoading, isError, onRetry, withDescription, showInactive, onShowInactiveChange, pending, compact } = props;
    const [editing, setEditing] = useState<MasterItem | 'new' | null>(null);
    const [deactivating, setDeactivating] = useState<MasterItem | null>(null);
    const sorted = [...(items ?? [])].sort(byActiveOrder);
    const close = () => setEditing(null);
    const submit = (payload: MasterPayload) => editing === 'new'
        ? props.onCreate(payload, close)
        : editing && props.onUpdate(editing.id, payload, close);

    return (
        <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
                {!compact && (
                    <label className="flex items-center gap-2.5">
                        <Switch checked={showInactive} onCheckedChange={onShowInactiveChange} aria-label="Tampilkan nonaktif" />
                        <span className="text-[13px]">Tampilkan nonaktif</span>
                    </label>
                )}
                <span className="flex-1" />
                {compact
                    ? <Button variant="soft" onClick={() => setEditing('new')}><Plus aria-hidden="true" />{`Tambah ${capitalize(noun)}`}</Button>
                    : <CreateButton label={`Tambah ${capitalize(noun)}`} onClick={() => setEditing('new')} />}
            </div>
            <section aria-label={`Daftar ${noun}`} className={cn(ADMIN_PANEL, 'overflow-hidden')}>
                {isLoading && <div className="h-32 animate-pulse bg-[hsl(var(--muted)/.5)] motion-reduce:animate-none" aria-busy="true" />}
                {isError && <div className="p-5"><ErrorState compact onRetry={onRetry} /></div>}
                {items && !sorted.length && <div className="p-5"><EmptyNote>{`Belum ada ${noun}.`}</EmptyNote></div>}
                {sorted.length > 0 && (
                    <ul className="divide-y divide-[hsl(var(--idesk-border)/.55)]">
                        {sorted.map((item) => (
                            <li key={item.id} className={cn('flex items-center gap-3 px-5 py-3.5', !item.isActive && 'opacity-60')}>
                                <span className="w-8 shrink-0 text-center text-[12px] tabular-nums text-[hsl(var(--idesk-text-secondary))]">{item.sortOrder}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="text-[14px] font-medium">{item.name}</span>
                                        {!item.isActive && <TicketPill tone="neutral">Nonaktif</TicketPill>}
                                    </span>
                                    {item.description && <span className={cn(MUTED_TEXT, 'block text-[12.5px]')}>{item.description}</span>}
                                </span>
                                <Button variant="subtle" size="icon" aria-label={`Ubah ${item.name}`} onClick={() => setEditing(item)}><Pencil aria-hidden="true" /></Button>
                                {item.isActive && <Button variant="danger" onClick={() => setDeactivating(item)}>Nonaktifkan</Button>}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) close(); }}>
                {editing !== null && (
                    <MasterDialog key={editing === 'new' ? 'new' : editing.id} noun={noun} item={editing === 'new' ? null : editing}
                        withDescription={withDescription} pending={pending} onClose={close} onSubmit={submit} />
                )}
            </Dialog>
            <ConfirmationDialog isOpen={!!deactivating} appearance="ticket" variant="destructive" title={`Nonaktifkan ${noun}?`}
                description={`"${deactivating?.name ?? ''}" tidak akan muncul di periode atau form baru. Data lama tetap tersimpan.`}
                confirmText="Nonaktifkan" cancelText="Batal" isLoading={pending} onCancel={() => setDeactivating(null)}
                onConfirm={() => deactivating && props.onDeactivate(deactivating.id, () => setDeactivating(null))} />
        </div>
    );
}
