import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus, Check, Ellipsis, Pencil, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TicketActionDialog } from '@/features/ticket-board/components/ticket-detail/TicketActionDialog';
import { getApiErrorMessage } from '../resolution/resolutionApi';
import type { FormTicketType } from './createTicketConfig';

/** Same limits as the server (user-ticket-template.constants.ts). */
export const MY_TEMPLATE_MAX = 20;
export const MY_TEMPLATE_LABEL_MIN = 2;
export const MY_TEMPLATE_LABEL_MAX = 40;

export interface MyTemplate {
    id: string;
    ticketType: FormTicketType;
    label: string;
    title: string;
    description: string;
    priority: string;
    category: string | null;
    device: string | null;
    software: string | null;
}

export type MyTemplateFields = Pick<MyTemplate, 'title' | 'description' | 'priority' | 'category' | 'device' | 'software'>;

const ENDPOINT = '/me/ticket-templates';
const MY_TEMPLATES_STALE_MS = 60_000;
const queryKey = (ticketType: FormTicketType | null) => ['my-ticket-templates', ticketType] as const;

/** The caller's templates for one form, plus save / rename / delete. */
export function useMyTemplates(ticketType: FormTicketType | null) {
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['my-ticket-templates'] });

    const list = useQuery({
        queryKey: queryKey(ticketType),
        queryFn: async () => (await api.get<MyTemplate[]>(ENDPOINT, { params: { ticketType } })).data,
        enabled: ticketType !== null,
        staleTime: MY_TEMPLATES_STALE_MS,
    });
    const save = useMutation({
        mutationFn: async (body: MyTemplateFields & { label: string }) =>
            (await api.post<MyTemplate>(ENDPOINT, { ...body, ticketType }, { skipToast: true })).data,
        onSuccess: (saved) => { toast.success(`Template "${saved.label}" disimpan`); void refresh(); },
    });
    const rename = useMutation({
        mutationFn: async ({ id, label }: { id: string; label: string }) =>
            (await api.patch<MyTemplate>(`${ENDPOINT}/${id}`, { label }, { skipToast: true })).data,
        onSuccess: () => { toast.success('Nama template diubah'); void refresh(); },
    });
    const remove = useMutation({
        mutationFn: async (id: string) => { await api.delete(`${ENDPOINT}/${id}`, { skipToast: true }); },
        onSuccess: () => { toast.success('Template dihapus'); void refresh(); },
        onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal menghapus template')),
    });

    return { templates: list.data ?? [], save, rename, remove };
}

interface TemplateNameDialogProps {
    open: boolean;
    mode: 'save' | 'rename';
    initialLabel?: string;
    busy: boolean;
    onClose: () => void;
    onSubmit: (label: string) => Promise<unknown>;
}

/** Ask for a chip name: used both to save the current form and to rename a template. */
export function TemplateNameDialog(props: TemplateNameDialogProps) {
    const title = props.mode === 'save' ? 'Simpan sebagai template' : 'Ganti nama template';
    return (
        <TicketActionDialog open={props.open} onClose={props.onClose} title={title} busy={props.busy}>
            {/* Remounted on every open, so the field always starts from initialLabel without an effect. */}
            {props.open && <TemplateNameForm key={props.initialLabel ?? ''} title={title} {...props} />}
        </TicketActionDialog>
    );
}

function TemplateNameForm({ mode, initialLabel = '', busy, onClose, onSubmit, title }: TemplateNameDialogProps & { title: string }) {
    const [label, setLabel] = useState(initialLabel);
    const [error, setError] = useState<string | null>(null);
    const trimmed = label.trim();
    const tooShort = trimmed.length < MY_TEMPLATE_LABEL_MIN;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (tooShort || busy) return;
        try {
            await onSubmit(trimmed);
            onClose();
        } catch (cause) {
            setError(getApiErrorMessage(cause, 'Gagal menyimpan template'));
        }
    };

    return (
        <form className="ticket-action-inner ticket-action-simple" onSubmit={submit}>
            <header className="ticket-action-header">
                <div><h2>{title}</h2>{mode === 'save' && <p>Judul, detail, urgensi, kategori, perangkat dan aplikasi ikut disimpan. Lampiran tidak.</p>}</div>
                <Button variant="subtle" size="icon" type="button" aria-label="Tutup dialog" onClick={onClose} disabled={busy}><X /></Button>
            </header>
            <div className="ticket-action-body">
                <div className="ticket-action-field">
                    <label htmlFor="my-template-label">Nama template <span aria-hidden="true" className="ticket-action-required">*</span></label>
                    <input id="my-template-label" value={label} autoFocus required maxLength={MY_TEMPLATE_LABEL_MAX} disabled={busy}
                        placeholder="Contoh: Laporan bulanan, Reset VPN mingguan"
                        onChange={(event) => { setLabel(event.target.value); setError(null); }} />
                    <span className="ticket-action-help ticket-action-count">{label.length}/{MY_TEMPLATE_LABEL_MAX}</span>
                    {error && <p role="alert">{error}</p>}
                </div>
            </div>
            <footer className="ticket-action-footer"><div>
                <Button variant="soft" type="button" onClick={onClose} disabled={busy}>Batal</Button>
                <Button variant="primary" type="submit" loading={busy} disabled={tooShort || busy}>
                    <BookmarkPlus />{mode === 'save' ? 'Simpan template' : 'Simpan nama'}
                </Button>
            </div></footer>
        </form>
    );
}

/** "Template saya" row under the built-in chips: pick to fill the form, ⋯ to rename or delete. */
export function MyTemplateChips({ templates, selectedId, onPick, onRename, onDelete }: {
    templates: readonly MyTemplate[];
    selectedId: string | null;
    onPick: (template: MyTemplate) => void;
    onRename: (template: MyTemplate) => void;
    onDelete: (template: MyTemplate) => void;
}) {
    if (templates.length === 0) return null;
    return (
        <section className="ct-templates ct-my-templates" aria-labelledby="ct-my-templates-label">
            <p className="ct-templates-label" id="ct-my-templates-label">
                <Star aria-hidden="true" />
                <span><strong>Template saya</strong> ({templates.length}/{MY_TEMPLATE_MAX})</span>
            </p>
            <div className="ct-templates-list" role="group" aria-labelledby="ct-my-templates-label">
                {templates.map((template) => {
                    const active = selectedId === template.id;
                    return (
                        <span key={template.id} className="ct-my-chip">
                            <button type="button" className="ct-chip" aria-pressed={active} title={template.title} onClick={() => onPick(template)}>
                                {active ? <Check aria-hidden="true" /> : <Star aria-hidden="true" />}
                                {template.label}
                            </button>
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <button type="button" className="ct-my-chip-menu" aria-label={`Kelola template ${template.label}`}>
                                        <Ellipsis aria-hidden="true" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" variant="compact">
                                    <DropdownMenuItem onSelect={() => onRename(template)}><Pencil />Ganti nama</DropdownMenuItem>
                                    <DropdownMenuItem variant="destructive" onSelect={() => onDelete(template)}><Trash2 />Hapus</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </span>
                    );
                })}
            </div>
        </section>
    );
}

/** Confirmation before a template is deleted. */
export function DeleteTemplateDialog({ template, busy, onClose, onConfirm }: {
    template: MyTemplate | null; busy: boolean; onClose: () => void; onConfirm: (template: MyTemplate) => void;
}) {
    return (
        <ConfirmationDialog
            appearance="ticket"
            isOpen={template !== null}
            title="Hapus template?"
            description={`Template "${template?.label ?? ''}" akan dihapus. Tiket yang sudah dibuat tidak terpengaruh.`}
            cancelText="Batal"
            confirmText="Hapus"
            variant="destructive"
            isLoading={busy}
            onCancel={onClose}
            onConfirm={() => { if (template) onConfirm(template); }}
        />
    );
}
