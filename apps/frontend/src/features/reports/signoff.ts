/** Editable sign-off block of the report PDFs. Mirrors the backend layout (report-signoff.ts) and its limits. */

export const MAX_SIGNOFF_SLOTS = 12;
export const MAX_SIGNOFF_COLUMNS = 4;

export type SignoffAlign = 'left' | 'center' | 'right';
export type SignoffReportType = 'monthly' | 'agent-performance' | 'ticket-volume';

export interface SignoffSlot {
    title: string;
    name: string;
    role: string;
    align: SignoffAlign;
    showDate: boolean;
}

export interface SignoffLayout {
    columns: number;
    slots: SignoffSlot[];
}

export const emptySlot = (): SignoffSlot => ({ title: 'Disetujui oleh', name: '', role: '', align: 'left', showDate: true });

/** What the backend prints when nothing is saved; shown in the editor so an edit starts from what the PDF already says. */
const BUILT_IN_SIGNERS: Record<SignoffReportType, [string, string]> = {
    monthly: ['IT Service Desk', 'IT Operations Manager'],
    'agent-performance': ['IT Service Lead', 'Head of ICT'],
    'ticket-volume': ['IT Service Lead', 'IT Operations Manager'],
};

export const builtInSignoff = (type: SignoffReportType): SignoffLayout => ({
    columns: 2,
    slots: [
        { title: 'Disiapkan oleh', name: BUILT_IN_SIGNERS[type][0], role: '', align: 'left', showDate: true },
        { title: 'Diketahui / disetujui oleh', name: BUILT_IN_SIGNERS[type][1], role: '', align: 'left', showDate: true },
    ],
});

/** Which report type a preview URL belongs to, or null for PDFs that have no sign-off block (tickets, forms). */
export const signoffTypeOf = (pdfUrl: string): SignoffReportType | null => {
    const match = /^\/reports\/export\/pdf\/(monthly|agent-performance|ticket-volume)(?:\?|$)/.exec(pdfUrl);
    return match ? (match[1] as SignoffReportType) : null;
};

/** The preview URL with a one-off layout attached. */
export const withSignoff = (pdfUrl: string, layout: SignoffLayout | null): string =>
    layout ? `${pdfUrl}${pdfUrl.includes('?') ? '&' : '?'}signoff=${encodeURIComponent(JSON.stringify(layout))}` : pdfUrl;

export const moveSlot = (slots: SignoffSlot[], from: number, to: number): SignoffSlot[] => {
    if (to < 0 || to >= slots.length || from === to) return slots;
    const next = [...slots];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
};
