import { EFormStatus } from '../../eform-request/entities/eform-request.entity';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { isSlaPausedPhase, PHASE_LABEL, phaseOf, type FlowPhase } from './flow-phase';

const NO_SCHEDULE = { hasOpenSchedule: false };
const SIGNED_NONE = { manager: false, gm: false };

describe('phaseOf', () => {
    it.each<[string, FlowPhase]>([
        [RequestStatus.SUBMITTED, 'review'],
        [RequestStatus.APPROVED, 'procure'],
        [RequestStatus.PROCUREMENT, 'procure'],
        [RequestStatus.AWAITING_DELIVERY, 'delivery'],
        [RequestStatus.AWAITING_USER_CONFIRMATION, 'confirm'],
        [RequestStatus.COMPLETED, 'done'],
        [RequestStatus.CLOSED, 'done'],
        [RequestStatus.REJECTED, 'rejected'],
        [RequestStatus.CANCELLED, 'rejected'],
    ])('hardware %s -> %s', (status, phase) => {
        expect(phaseOf('HARDWARE', status, NO_SCHEDULE)).toBe(phase);
    });

    it('hardware INSTALLATION without a confirmed schedule is scheduling, with one it is installing', () => {
        expect(phaseOf('HARDWARE', RequestStatus.INSTALLATION, { hasOpenSchedule: false })).toBe('schedule');
        expect(phaseOf('HARDWARE', RequestStatus.INSTALLATION, { hasOpenSchedule: true })).toBe('install');
    });

    it('hardware UNDER_REVIEW splits by route and signatures', () => {
        const under = (ctx: object) => phaseOf('HARDWARE', RequestStatus.UNDER_REVIEW, { ...NO_SCHEDULE, ...ctx });
        expect(under({ route: null, signed: SIGNED_NONE })).toBe('review');
        expect(under({ route: 'MANAGER', signed: SIGNED_NONE, returnedReason: 'Ganti vendor' })).toBe('review');
        expect(under({ route: 'MANAGER', signed: SIGNED_NONE })).toBe('appr_mgr');
        expect(under({ route: 'MANAGER_GM', signed: { manager: true, gm: false } })).toBe('appr_gm');
        expect(under({ route: 'MANAGER_GM', signed: SIGNED_NONE })).toBe('appr_mgr');
    });

    it.each<[string, FlowPhase]>([
        [EFormStatus.PENDING_REVIEW, 'review'],
        [EFormStatus.PENDING_MANAGER, 'appr_mgr'],
        [EFormStatus.PENDING_GM, 'appr_gm'],
        [EFormStatus.PENDING_ICT, 'fulfill'],
        ['AWAITING_CONFIRMATION', 'confirm'],
        [EFormStatus.CONFIRMED, 'done'],
        [EFormStatus.REJECTED, 'rejected'],
        [EFormStatus.CANCELLED, 'rejected'],
    ])('e-form %s -> %s', (status, phase) => {
        expect(phaseOf('EFORM', status, NO_SCHEDULE)).toBe(phase);
    });
});

describe('phase labels and SLA', () => {
    it('labels match the mockup', () => {
        expect(PHASE_LABEL).toEqual({
            review: 'Review IT', appr_mgr: 'Menunggu Atasan', appr_gm: 'Menunggu GM', procure: 'Pengadaan',
            delivery: 'Menunggu barang tiba', schedule: 'Penjadwalan instalasi', install: 'Instalasi', fulfill: 'Pemenuhan akses',
            confirm: 'Menunggu konfirmasi pemohon', done: 'Selesai', rejected: 'Ditolak',
        });
    });

    it('paused phases are approval, procurement, delivery', () => {
        const paused = (Object.keys(PHASE_LABEL) as FlowPhase[]).filter(isSlaPausedPhase);
        expect(paused).toEqual(['appr_mgr', 'appr_gm', 'procure', 'delivery']);
    });
});
