import { FileArchive, FileSpreadsheet, FileText, FileVideo, File as FileIcon, Presentation, type LucideIcon } from 'lucide-react';

/** Original file details the backend stores beside each attachment path (absent on older messages). */
export interface AttachmentInfo {
    path: string;
    name: string;
    size: number;
    mime: string;
}

interface AttachmentKind {
    Icon: LucideIcon;
    /** Short type label shown next to the size, e.g. "XLSX". */
    label: string;
    /** Icon tile colours. */
    tone: string;
}

const KINDS: Array<{ exts: string[]; kind: Omit<AttachmentKind, 'label'> }> = [
    { exts: ['.pdf'], kind: { Icon: FileText, tone: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' } },
    { exts: ['.doc', '.docx', '.txt'], kind: { Icon: FileText, tone: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' } },
    { exts: ['.xls', '.xlsx', '.csv'], kind: { Icon: FileSpreadsheet, tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' } },
    { exts: ['.ppt', '.pptx'], kind: { Icon: Presentation, tone: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' } },
    { exts: ['.zip', '.rar', '.7z'], kind: { Icon: FileArchive, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' } },
    { exts: ['.mp4', '.mov', '.webm'], kind: { Icon: FileVideo, tone: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' } },
];

const FALLBACK: Omit<AttachmentKind, 'label'> = {
    Icon: FileIcon,
    tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export const extensionOf = (name: string): string => {
    const clean = name.split(/[?#]/)[0];
    const dot = clean.lastIndexOf('.');
    return dot === -1 ? '' : clean.slice(dot).toLowerCase();
};

export const attachmentKind = (name: string): AttachmentKind => {
    const ext = extensionOf(name);
    const kind = KINDS.find((k) => k.exts.includes(ext))?.kind ?? FALLBACK;
    return { ...kind, label: ext ? ext.slice(1).toUpperCase() : 'FILE' };
};
