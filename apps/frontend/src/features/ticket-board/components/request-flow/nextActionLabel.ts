const ACTION_BY_PHASE: Record<string, string> = {
    review: 'Tinjau permintaan',
    appr_mgr: 'Perlu tanda tangan Anda',
    appr_gm: 'Perlu tanda tangan Anda',
    procure: 'Catat pembelian',
    delivery: 'Konfirmasi barang tiba',
    schedule: 'Atur jadwal pemasangan',
    install: 'Selesaikan pemasangan',
    fulfill: 'Aktifkan akses',
    confirm: 'Perlu konfirmasi Anda',
};

const FALLBACK = 'Perlu tindakan Anda';

/** What the viewer has to do on a request whose turn it is, named after the step (list rows, instead of a generic "your turn"). */
export function nextActionLabel(phase: string | null | undefined): string {
    return (phase && ACTION_BY_PHASE[phase]) || FALLBACK;
}
