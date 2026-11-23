import { describe, expect, it } from 'vitest';
import type { FlowPhase, FlowSchedule, RequestFlowView, ViewerRoleInFlow } from '../flowTypes';
import { nextStep } from '../nextStep';

const SLOTS = [{ start: '2026-11-24T02:00:00Z', end: '2026-11-24T04:00:00Z' }, { start: '2026-11-25T02:00:00Z', end: '2026-11-25T04:00:00Z' }];
const schedule = (over: Partial<FlowSchedule> = {}): FlowSchedule => ({ slots: SLOTS, chosen: null, technicianName: 'Yudi', status: 'PROPOSED_AWAITING_USER', resched: 0, note: null, ...over });
const hw = (sched: FlowSchedule | null = null) => ({ requestNumber: 'HR-1', division: 'QC', recipients: ['Leony'], items: [], schedule: sched, assets: [] });

function view(over: Partial<RequestFlowView> & { phase: FlowPhase }): RequestFlowView {
    return {
        kind: 'HARDWARE', phaseLabel: '', route: 'MANAGER', managerId: 'm', gmId: null, hardwareSource: 'NON_BUDGET', returnedReason: null,
        rescheduleCount: 0, documentVersion: 3, revisions: [], viewerRoleInFlow: 'ICT', hardware: hw(), ...over,
    };
}
function eform(over: Partial<RequestFlowView> & { phase: FlowPhase }, formType = 'VPN', endDate: string | null = '2026-12-31'): RequestFlowView {
    return view({
        kind: 'EFORM', hardware: undefined,
        eform: { formType, documentNumber: 'F/1', startDate: '2026-11-01', endDate, fields: {}, hasCredentials: true, requiresGm: false }, ...over,
    });
}
const as = (v: RequestFlowView, role: ViewerRoleInFlow) => nextStep({ ...v, viewerRoleInFlow: role });

describe('nextStep: IT', () => {
    it('review: one primary button, reject hides in the menu', () => {
        const n = as(view({ phase: 'review' }), 'ICT');
        expect(n).toMatchObject({ mine: true, primary: { act: 'review', label: 'Tinjau sekarang' } });
        expect(n.second).toBeUndefined();
        expect(n.more.map((m) => m.act)).toContain('rejectIT');
    });

    it.each(['appr_mgr', 'appr_gm'] as const)('%s: nothing to do, a gentle reminder and paper signing in the menu', (phase) => {
        const n = as(view({ phase }), 'ICT');
        expect(n.mine).toBe(false);
        expect(n.primary).toBeUndefined();
        expect(n.second?.act).toBe('remind');
        expect(n.more.map((m) => m.act)).toContain('paper');
    });

    it('procure: record the purchase', () => {
        expect(as(view({ phase: 'procure' }), 'ICT')).toMatchObject({ mine: true, primary: { act: 'procure' }, second: { act: 'editItems' } });
    });

    it('delivery: confirm the goods arrived', () => {
        expect(as(view({ phase: 'delivery' }), 'ICT')).toMatchObject({ mine: true, primary: { act: 'arrived' } });
    });

    it('schedule: propose slots; wait for the requester once slots exist and none is chosen', () => {
        expect(as(view({ phase: 'schedule' }), 'ICT')).toMatchObject({ mine: true, primary: { act: 'schedule' } });
        const waiting = as(view({ phase: 'schedule', hardware: hw(schedule()) }), 'ICT');
        expect(waiting.mine).toBe(false);
        expect(waiting.primary).toBeUndefined();
        expect(waiting.more.map((m) => m.act)).toContain('pickSlot');
    });

    it('schedule after the requester asked for another time: shows the count and asks for new slots', () => {
        const n = as(view({ phase: 'schedule', rescheduleCount: 1, hardware: hw(schedule({ chosen: 0, status: 'RESCHEDULE_REQUESTED', resched: 1 })) }), 'ICT');
        expect(n.title).toContain('1/3');
        expect(n.primary?.act).toBe('schedule');
    });

    it('install: start first, then finish with the asset codes', () => {
        expect(as(view({ phase: 'install', hardware: hw(schedule({ chosen: 0, status: 'CONFIRMED' })) }), 'ICT').primary?.act).toBe('startInstall');
        expect(as(view({ phase: 'install', hardware: hw(schedule({ chosen: 0, status: 'IN_PROGRESS' })) }), 'ICT').primary?.act).toBe('installDone');
    });

    it('fulfill: credentials for VPN, "Akses sudah aktif" for NAS', () => {
        expect(as(eform({ phase: 'fulfill' }), 'ICT').primary).toMatchObject({ act: 'fulfill', label: 'Isi kredensial' });
        expect(as(eform({ phase: 'fulfill' }, 'SYNOLOGY_NAS'), 'ICT').primary).toMatchObject({ act: 'fulfill', label: 'Akses sudah aktif' });
    });

    it('confirm: IT only waits, and may confirm on behalf from the menu', () => {
        const n = as(view({ phase: 'confirm' }), 'ICT');
        expect(n.mine).toBe(false);
        expect(n.more.map((m) => m.act)).toContain('confirmOnBehalf');
    });
});

describe('nextStep: requester, approver, observer', () => {
    it('requester confirms a finished install: a primary yes and a secondary issue button', () => {
        expect(as(view({ phase: 'confirm' }), 'REQUESTER')).toMatchObject({ mine: true, primary: { act: 'confirm', label: 'Ya, sudah berfungsi' }, second: { act: 'reportIssue' } });
    });

    it('requester picks a slot when IT proposed some', () => {
        expect(as(view({ phase: 'schedule', hardware: hw(schedule()) }), 'REQUESTER')).toMatchObject({ mine: true, primary: { act: 'pickSlot' } });
    });

    it('requester of an e-form tries the access: yes / issue, and may view the credentials', () => {
        const n = as(eform({ phase: 'confirm' }), 'REQUESTER');
        expect(n).toMatchObject({ mine: true, primary: { act: 'confirm', label: 'Ya, berhasil' }, second: { act: 'reportIssue' } });
        expect(n.more.map((m) => m.act)).toContain('showCred');
    });

    it('the approver whose turn it is gets one green button; the other approver only waits', () => {
        expect(as(view({ phase: 'appr_mgr' }), 'APPROVER_CURRENT')).toMatchObject({ mine: true, primary: { act: 'approve' } });
        const other = as(view({ phase: 'appr_gm' }), 'APPROVER');
        expect(other.mine).toBe(false);
        expect(other.primary).toBeUndefined();
    });

    it('an observer sees who the request waits for and nothing to press', () => {
        const n = as(view({ phase: 'procure' }), 'OBSERVER');
        expect(n.mine).toBe(false);
        expect(n.primary).toBeUndefined();
        expect(n.title).toMatch(/Sedang diproses/);
    });

    it('a requester has nothing to do while IT works on it', () => {
        const n = as(view({ phase: 'procure' }), 'REQUESTER');
        expect(n.mine).toBe(false);
        expect(n.primary).toBeUndefined();
    });
});

describe('nextStep: the ends', () => {
    it('done: an e-form with an end date offers renewal and the credentials to its requester', () => {
        const n = as(eform({ phase: 'done' }), 'REQUESTER');
        expect(n).toMatchObject({ primary: { act: 'renew' }, second: { act: 'showCred' } });
        expect(n.title).toContain('Akses aktif sampai');
    });

    it('done: a permanent e-form access has no renewal', () => {
        expect(as(eform({ phase: 'done' }, 'VPN', null), 'REQUESTER').primary).toBeUndefined();
    });

    it('done: a hardware ticket only links to the final document', () => {
        expect(as(view({ phase: 'done' }), 'ICT')).toMatchObject({ title: 'Tiket selesai', second: { act: 'tabDoc' } });
    });

    it('rejected: says so and offers nothing', () => {
        const n = as(view({ phase: 'rejected' }), 'ICT');
        expect(n.title).toBe('Permintaan ditolak');
        expect(n.primary).toBeUndefined();
    });
});
