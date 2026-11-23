import { RESCHEDULE_LIMIT, type RequestFlowView } from './flowTypes';

/** One button of the "next step" bar. `cls` is the button style; the dialogs and endpoints behind `act` live in the page. */
export interface StepAction { act: string; label: string; icon?: string; cls?: string; danger?: boolean }

export interface NextStep {
    /** It is the viewer's turn: the bar is highlighted and says "Giliran Anda". */
    mine: boolean;
    tone: 'hw' | 'ef' | 'navy';
    icon: string;
    title: string;
    sub: string;
    primary?: StepAction;
    second?: StepAction;
    /** The "Lainnya" menu: rare actions stay out of sight. */
    more: StepAction[];
}

const NO_ACTIONS: StepAction[] = [];
const AUTO_CLOSE_NOTE = 'Tiket tertutup otomatis setelah 1 hari kerja tanpa respons.';
/** Access kinds IT activates without handing over a username and password. */
const NO_CREDENTIAL_KINDS = ['SYNOLOGY_NAS', 'WEBSITE'];

const dateLabel = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });
const dayLabel = (iso: string): string => dateLabel.format(new Date(iso));

const slotLabel = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * What the viewer should do next, from the request's phase and how the viewer relates to it. One primary button at
 * most, so nobody has to guess which one to press; the table follows the approved mockup (`nextOf`).
 */
export function nextStep(view: RequestFlowView, viewerId?: string): NextStep {
    const base = baseStep(view, viewerId);
    if (!canCancel(view)) return base;
    return { ...base, more: [...base.more, { act: 'cancelReq', label: 'Batalkan permintaan', icon: 'xC', danger: true }] };
}

/** Mirrors the backend: the requester may withdraw while it is in review or waiting for a signature; IT any time before installing. */
const REQUESTER_CANCEL_PHASES: readonly string[] = ['review', 'appr_mgr', 'appr_gm'];
const IT_CANCEL_PHASES: readonly string[] = ['review', 'appr_mgr', 'appr_gm', 'procure', 'delivery', 'schedule', 'fulfill'];
function canCancel(view: RequestFlowView): boolean {
    if (view.viewerRoleInFlow === 'REQUESTER') return REQUESTER_CANCEL_PHASES.includes(view.phase);
    if (view.viewerRoleInFlow === 'ICT') return IT_CANCEL_PHASES.includes(view.phase);
    return false;
}

function baseStep(view: RequestFlowView, viewerId?: string): NextStep {
    const tone = view.kind === 'HARDWARE' ? 'hw' : 'ef';
    const primaryClass = view.kind === 'HARDWARE' ? 'hwb' : 'efb';
    const P = (act: string, label: string, icon: string, cls: string = primaryClass): StepAction => ({ act, label, icon, cls });
    const step = (o: Partial<NextStep> & Pick<NextStep, 'icon' | 'title' | 'sub'>): NextStep => ({ mine: false, tone, more: NO_ACTIONS, ...o });
    const { phase, viewerRoleInFlow: role } = view;
    const schedule = view.hardware?.schedule ?? null;
    const slotsOffered = Boolean(schedule && schedule.chosen === null);

    if (phase === 'done' && view.kind === 'EFORM' && role === 'REQUESTER') {
        const end = view.eform?.endDate;
        return step({
            tone: 'navy', icon: 'key', title: end ? `Akses aktif sampai ${dayLabel(end)}` : 'Akses aktif (permanen)',
            sub: 'Kami ingatkan H-7, H-3 dan di hari terakhir.',
            primary: end ? P('renew', 'Perpanjang akses', 'refresh') : undefined,
            second: view.eform?.hasCredentials ? P('showCred', 'Lihat kredensial', 'key', '') : undefined,
            more: [{ act: 'tabDoc', label: 'Dokumen final', icon: 'fileCheck' }],
        });
    }
    if (phase === 'done') {
        return step({ tone: 'navy', icon: 'checkC', title: 'Tiket selesai', sub: 'Semua tanda tangan tersimpan di dokumen final.', second: P('tabDoc', 'Lihat dokumen final', 'fileCheck', '') });
    }
    if (phase === 'rejected') {
        return step({ tone: 'navy', icon: 'xC', title: 'Permintaan ditolak', sub: 'Alasannya ada di percakapan. Silakan buat tiket baru bila masih dibutuhkan.' });
    }

    if (role === 'ICT') return forIt(view, step, P, slotsOffered, viewerId);
    if (role === 'REQUESTER') {
        if (phase === 'schedule' && slotsOffered) {
            return step({ mine: true, icon: 'cal', title: 'Pilih waktu pemasangan', sub: 'IT mengusulkan beberapa waktu. Pilih yang Anda bisa, atau minta waktu lain.', primary: P('pickSlot', 'Pilih waktu', 'cal', 'navy') });
        }
        if (phase === 'confirm') {
            return view.kind === 'HARDWARE'
                ? step({ mine: true, icon: 'checkC', title: 'Apakah perangkat sudah terpasang dan berfungsi?', sub: 'Tekan "Ya" untuk menutup tiket. Ada masalah? Pilih "Ada kendala".', primary: P('confirm', 'Ya, sudah berfungsi', 'check', 'green'), second: P('reportIssue', 'Ada kendala', 'alert', '') })
                : step({
                    mine: true, icon: 'key', title: 'Akses Anda sudah aktif — silakan dicoba', sub: 'Berhasil login? Tekan "Ya". Gagal? Pilih "Ada kendala".',
                    primary: P('confirm', 'Ya, berhasil', 'check', 'green'), second: P('reportIssue', 'Ada kendala', 'alert', ''),
                    more: view.eform?.hasCredentials ? [{ act: 'showCred', label: 'Lihat kredensial', icon: 'eye' }] : NO_ACTIONS,
                });
        }
    }
    if (role === 'APPROVER_CURRENT' && (phase === 'appr_mgr' || phase === 'appr_gm')) {
        return step({
            mine: true, icon: 'pen', title: 'Pemohon meminta persetujuan Anda',
            sub: 'Tekan tombol hijau untuk melihat ringkasan, lalu setujui atau tolak di sana. Ada pertanyaan? Tulis di chat.',
            primary: P('approve', 'Periksa & setujui', 'pen', 'green'),
        });
    }
    return step({ tone: 'navy', icon: 'hourglass', title: `Sedang diproses: menunggu ${waitingFor(view)}`, sub: 'Tidak ada yang perlu Anda lakukan sekarang. Anda akan diberi notifikasi.' });
}

/** Who the request waits for, in words the page can show to anyone. */
function waitingFor(view: RequestFlowView): string {
    switch (view.phase) {
        case 'appr_mgr': return 'tanda tangan atasan';
        case 'appr_gm': return 'tanda tangan GM';
        case 'schedule': return view.hardware?.schedule?.chosen === null ? 'pemohon memilih jadwal' : 'IT menyiapkan jadwal';
        case 'confirm': return 'konfirmasi pemohon';
        default: return 'tim IT';
    }
}

type Make = (o: Partial<NextStep> & Pick<NextStep, 'icon' | 'title' | 'sub'>) => NextStep;
type Action = (act: string, label: string, icon: string, cls?: string) => StepAction;

function forIt(view: RequestFlowView, step: Make, P: Action, slotsOffered: boolean, viewerId?: string): NextStep {
    const { phase } = view;
    const schedule = view.hardware?.schedule ?? null;
    const editMore: StepAction[] = ['review', 'appr_mgr', 'appr_gm', 'procure', 'delivery', 'schedule'].includes(phase)
        ? [{ act: 'editItems', label: 'Ubah / ganti barang', icon: 'pen' }] : NO_ACTIONS;
    switch (phase) {
        case 'review':
            return step({
                mine: true, icon: 'shield', title: 'Tinjau permintaan ini', sub: 'Periksa barang, ubah bila perlu, lalu pilih siapa yang harus menyetujui.',
                primary: P('review', 'Tinjau sekarang', 'shield'), more: [{ act: 'rejectIT', label: 'Tolak permintaan', icon: 'xC', danger: true }],
            });
        case 'appr_mgr':
        case 'appr_gm':
            return step({
                tone: 'navy', icon: 'pen', title: `Menunggu tanda tangan ${phase === 'appr_mgr' ? 'atasan' : 'GM'}`,
                sub: 'Tidak ada yang perlu Anda lakukan. Bila beliau tanda tangan di kertas, pakai "TTD kertas".',
                second: P('remind', 'Ingatkan', 'bell', ''), more: [{ act: 'paper', label: 'TTD kertas (unduh & unggah)', icon: 'upload' }, ...editMore],
            });
        case 'procure':
            return step({ mine: true, icon: 'package', title: 'Catat pembelian barang', sub: 'Isi vendor & biaya. Barang tidak tersedia? Ganti dulu lewat "Ubah barang".', primary: P('procure', 'Catat pembelian', 'package'), second: P('editItems', 'Ubah barang', 'pen', '') });
        case 'delivery':
            return step({ mine: true, icon: 'truck', title: 'Barang sudah sampai di IT?', sub: 'Tekan setelah barang diterima gudang IT.', primary: P('arrived', 'Ya, barang sudah tiba', 'truck'), more: editMore });
        case 'schedule':
            if (slotsOffered && schedule) {
                return step({
                    tone: 'navy', icon: 'cal', title: 'Menunggu pemohon memilih jadwal',
                    sub: `Usulan: ${schedule.slots.map((s) => slotLabel.format(new Date(s.start))).join(' / ')}`,
                    more: [{ act: 'pickSlot', label: 'Pilih atas nama pemohon', icon: 'cal' }, ...editMore],
                });
            }
            return step({
                mine: true, icon: 'cal',
                title: view.rescheduleCount ? `Pemohon minta waktu lain (${view.rescheduleCount}/${RESCHEDULE_LIMIT})` : 'Usulkan jadwal pemasangan',
                sub: view.rescheduleCount ? 'Kirim pilihan waktu yang baru.' : 'Pilih teknisi dan 1–3 pilihan waktu; pemohon tinggal memilih.',
                primary: P('schedule', 'Usulkan jadwal', 'cal'), more: editMore,
            });
        case 'install': {
            const running = schedule?.status === 'IN_PROGRESS';
            const when = schedule && schedule.chosen !== null ? slotLabel.format(new Date(schedule.slots[schedule.chosen].start)) : '';
            // The server lets only the assigned technician start; anyone else would get a 403, so no button.
            const otherTechnician = Boolean(!running && viewerId && schedule?.technicianId && schedule.technicianId !== viewerId);
            if (otherTechnician) {
                return step({
                    tone: 'navy', icon: 'wrench', title: `Pemasangan ${when}`,
                    sub: `Teknisi ${schedule?.technicianName ?? 'IT'} yang memulai pemasangan ini.`,
                    more: [{ act: 'reschedule', label: 'Ubah jadwal', icon: 'cal' }],
                });
            }
            return running
                ? step({ mine: true, icon: 'wrench', title: 'Pemasangan sedang berjalan', sub: 'Selesai? Catat barcode aset dan foto serah terima.', primary: P('installDone', 'Selesaikan pemasangan', 'barcode') })
                : step({
                    mine: true, icon: 'wrench', title: `Pemasangan ${when}`, sub: `Teknisi ${schedule?.technicianName ?? 'IT'}. Tekan saat mulai bekerja di lokasi.`,
                    primary: P('startInstall', 'Mulai pemasangan', 'wrench'), more: [{ act: 'reschedule', label: 'Ubah jadwal', icon: 'cal' }],
                });
        }
        case 'fulfill':
            return step({
                mine: true, icon: 'key', title: 'Berikan akses', sub: 'Aktifkan akses di sistem, lalu simpan kredensialnya di sini (terenkripsi).',
                primary: P('fulfill', NO_CREDENTIAL_KINDS.includes(view.eform?.formType ?? '') ? 'Akses sudah aktif' : 'Isi kredensial', 'key'),
            });
        case 'confirm':
            return step({
                tone: 'navy', icon: 'hourglass', title: 'Menunggu konfirmasi pemohon', sub: AUTO_CLOSE_NOTE,
                more: [{ act: 'confirmOnBehalf', label: 'Konfirmasi atas nama pemohon', icon: 'check' }],
            });
        default:
            return step({ tone: 'navy', icon: 'hourglass', title: 'Sedang diproses', sub: '' });
    }
}
