import { useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import type { FormTicketType, TicketTemplate } from './createTicketConfig';
import {
    DeleteTemplateDialog, MY_TEMPLATE_MAX, MyTemplateChips, TemplateNameDialog, useMyTemplates,
    type MyTemplate, type MyTemplateFields,
} from './MyTemplates';

/** Selection key of a personal template; built-in chips use their label. */
export const myTemplateKey = (id: string) => `my:${id}`;

/** A personal template in the shape the form's template handler already applies. */
export const toTicketTemplate = (template: MyTemplate): TicketTemplate => ({
    key: myTemplateKey(template.id),
    label: template.label,
    subject: template.title,
    description: template.description,
    priority: template.priority,
    category: template.category ?? undefined,
    device: template.device ?? undefined,
    software: template.software ?? undefined,
});

interface Options {
    /** null on the type picker: nothing is loaded or shown. */
    ticketType: FormTicketType | null;
    /** Current form values, saved as the new template. */
    form: MyTemplateFields;
    selectedKey: string | null;
    onPick: (template: TicketTemplate) => void;
}

/** "Template saya" chips, the save button for the submit bar, and their dialogs. */
export function useMyTemplateControls({ ticketType, form, selectedKey, onPick }: Options) {
    const { templates, save, rename, remove } = useMyTemplates(ticketType);
    const [saving, setSaving] = useState(false);
    const [renaming, setRenaming] = useState<MyTemplate | null>(null);
    const [deleting, setDeleting] = useState<MyTemplate | null>(null);

    const atLimit = templates.length >= MY_TEMPLATE_MAX;
    const hasContent = Boolean(form.title.trim() && form.description.trim());
    const selectedId = selectedKey?.startsWith('my:') ? selectedKey.slice(3) : null;

    const chips = (
        <MyTemplateChips templates={templates} selectedId={selectedId}
            onPick={(template) => onPick(toTicketTemplate(template))} onRename={setRenaming} onDelete={setDeleting} />
    );

    const saveButton = (
        <button type="button" className="ct-save-template" onClick={() => setSaving(true)} disabled={!hasContent || atLimit}
            title={atLimit ? `Maksimal ${MY_TEMPLATE_MAX} template. Hapus template lama dulu.` : hasContent ? 'Simpan isi form ini untuk dipakai lagi' : 'Isi judul dan detail dulu'}>
            <BookmarkPlus aria-hidden="true" /><span>Simpan sebagai template</span>
        </button>
    );

    const dialogs = (
        <>
            <TemplateNameDialog open={saving} mode="save" busy={save.isPending} onClose={() => setSaving(false)}
                onSubmit={(label) => save.mutateAsync({ ...form, label })} />
            <TemplateNameDialog open={renaming !== null} mode="rename" initialLabel={renaming?.label} busy={rename.isPending}
                onClose={() => setRenaming(null)}
                onSubmit={(label) => (renaming ? rename.mutateAsync({ id: renaming.id, label }) : Promise.resolve())} />
            <DeleteTemplateDialog template={deleting} busy={remove.isPending} onClose={() => setDeleting(null)}
                onConfirm={(template) => remove.mutate(template.id, { onSettled: () => setDeleting(null) })} />
        </>
    );

    return { chips, saveButton, dialogs };
}

export type MyTemplateControls = ReturnType<typeof useMyTemplateControls>;
