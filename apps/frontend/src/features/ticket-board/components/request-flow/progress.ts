import type { FlowPhase, RequestFlowView } from './flowTypes';

export type SubState = 'done' | 'cur' | 'future' | 'skip' | 'no';
export interface SubStage { k: string; label: string; who: string; state: SubState }
export interface Stage { name: string; subs: SubStage[]; state: 'done' | 'cur' | 'future' | 'no'; skipped: boolean }

/** The order phases happen in; a sub-step is done once the request is past it. */
const PHASE_ORDER: readonly FlowPhase[] = ['review', 'appr_mgr', 'appr_gm', 'procure', 'delivery', 'schedule', 'install', 'fulfill', 'confirm', 'done'];

interface Blueprint { k: string; label: string; who: string; skip?: boolean; forceDone?: boolean }
interface StageBlueprint { name: string; subs: Blueprint[] }

function blueprint(view: RequestFlowView): StageBlueprint[] {
    const decided = view.route !== null;
    const head: StageBlueprint[] = [
        { name: 'Pengajuan', subs: [{ k: '_', label: 'Diajukan & ditandatangani', who: 'Pemohon', forceDone: true }] },
        {
            name: 'Review & persetujuan',
            subs: [
                { k: 'review', label: 'Review IT', who: 'IT meninjau & memilih alur persetujuan' },
                { k: 'appr_mgr', label: 'Tanda tangan atasan', who: 'Atasan pemohon', skip: decided && view.route === 'NONE' },
                { k: 'appr_gm', label: 'Tanda tangan GM', who: 'GM', skip: decided && view.route !== 'MANAGER_GM' },
            ],
        },
    ];
    const tail: StageBlueprint[] = [{ name: 'Selesai', subs: [{ k: 'confirm', label: 'Konfirmasi pemohon', who: 'Tiket ditutup setelah pemohon mengonfirmasi' }] }];
    if (view.kind === 'HARDWARE') {
        const stock = view.hardwareSource === 'IT_STOCK';
        const schedule = view.hardware?.schedule ?? null;
        return [
            ...head,
            {
                name: stock ? 'Barang (dari stok IT)' : 'Pengadaan barang',
                subs: [
                    { k: 'procure', label: 'Keputusan pengadaan', who: 'Vendor, biaya & item disetujui', skip: stock },
                    { k: 'delivery', label: 'Barang tiba', who: 'Diterima gudang IT', skip: stock },
                ],
            },
            {
                name: 'Pemasangan',
                subs: [
                    { k: 'schedule', label: 'Jadwal disepakati', who: schedule ? 'Pemohon memilih dari usulan IT' : 'IT mengusulkan jadwal' },
                    { k: 'install', label: 'Instalasi', who: schedule?.technicianName ?? 'Teknisi IT' },
                ],
            },
            ...tail,
        ];
    }
    return [...head, { name: 'Pemberian akses', subs: [{ k: 'fulfill', label: view.eform?.hasCredentials ? 'Kredensial diberikan' : 'Akses diaktifkan IT', who: 'Tim IT' }] }, ...tail];
}

function subState(view: RequestFlowView, sub: Blueprint): SubState {
    if (sub.forceDone) return 'done';
    if (sub.skip) return 'skip';
    if (view.phase === 'done') return 'done';
    // A rejected request stopped where it was; it no longer has a phase of its own to compare with.
    if (view.phase === 'rejected') return 'no';
    const a = PHASE_ORDER.indexOf(sub.k as FlowPhase);
    const b = PHASE_ORDER.indexOf(view.phase);
    if (a < b) return 'done';
    return a === b ? 'cur' : 'future';
}

/** The big numbered stages of the progress card, each with its sub-steps; `curIdx` is the stage being worked on. */
export function stageInfo(view: RequestFlowView): { stages: Stage[]; curIdx: number } {
    const stages = blueprint(view).map((bp): Stage => {
        const subs = bp.subs.map((s) => ({ k: s.k, label: s.label, who: s.who, state: subState(view, s) }));
        const live = subs.filter((s) => s.state !== 'skip');
        let state: Stage['state'] = 'future';
        if (live.some((s) => s.state === 'no')) state = 'no';
        else if (live.some((s) => s.state === 'cur')) state = 'cur';
        else if (live.every((s) => s.state === 'done')) state = 'done';
        return { name: bp.name, subs, state, skipped: live.length === 0 };
    });
    const idx = stages.findIndex((s) => s.state === 'cur' || s.state === 'no');
    return { stages, curIdx: idx < 0 ? stages.length - 1 : idx };
}
