import { describe, expect, it } from 'vitest';
import type { FlowPhase, RequestFlowView } from '../flowTypes';
import { stageInfo } from '../progress';

function v(over: Partial<RequestFlowView> & { phase: FlowPhase }): RequestFlowView {
    return {
        kind: 'HARDWARE', phaseLabel: '', route: 'MANAGER', managerId: 'm', gmId: null, hardwareSource: 'NON_BUDGET', returnedReason: null,
        rescheduleCount: 0, documentVersion: 1, revisions: [], viewerRoleInFlow: 'ICT',
        hardware: { requestNumber: 'HR-1', division: 'QC', recipients: [], items: [], schedule: null, assets: [] }, ...over,
    };
}

describe('stageInfo', () => {
    it('hardware has five stages and the current one follows the phase', () => {
        const { stages, curIdx } = stageInfo(v({ phase: 'procure' }));
        expect(stages.map((s) => s.name)).toEqual(['Pengajuan', 'Review & persetujuan', 'Pengadaan barang', 'Pemasangan', 'Selesai']);
        expect(stages[curIdx].name).toBe('Pengadaan barang');
        expect(stages[0].state).toBe('done');
        expect(stages[1].state).toBe('done');
        expect(stages[3].state).toBe('future');
    });

    it('IT stock skips the procurement stage', () => {
        const { stages } = stageInfo(v({ phase: 'schedule', hardwareSource: 'IT_STOCK' }));
        expect(stages.find((s) => s.name === 'Barang (dari stok IT)')!.skipped).toBe(true);
    });

    it('route NONE skips manager and GM; route MANAGER skips only GM', () => {
        const none = stageInfo(v({ phase: 'procure', route: 'NONE' })).stages[1].subs;
        expect(none.filter((s) => s.state === 'skip').map((s) => s.k)).toEqual(['appr_mgr', 'appr_gm']);
        const mgr = stageInfo(v({ phase: 'appr_mgr', route: 'MANAGER' })).stages[1].subs;
        expect(mgr.find((s) => s.k === 'appr_gm')!.state).toBe('skip');
        expect(mgr.find((s) => s.k === 'appr_mgr')!.state).toBe('cur');
    });

    it('an e-form has an access stage instead of the hardware stages', () => {
        const eform = { formType: 'VPN', documentNumber: 'F', startDate: '', endDate: null, fields: {}, hasCredentials: false, requiresGm: false };
        const { stages } = stageInfo(v({ kind: 'EFORM', phase: 'fulfill', hardware: undefined, eform }));
        expect(stages.map((s) => s.name)).toEqual(['Pengajuan', 'Review & persetujuan', 'Pemberian akses', 'Selesai']);
    });

    it('done marks every stage done', () => {
        expect(stageInfo(v({ phase: 'done' })).stages.every((s) => s.state === 'done')).toBe(true);
    });
});
