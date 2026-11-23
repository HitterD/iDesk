import { UserRole } from '../../users/enums/user-role.enum';
import { listFieldsOf, loadFlowListFields, type FlowListRow } from './request-flow-list-fields';

const row = (over: Partial<FlowListRow> = {}): FlowListRow => ({
    ticketId: 't-1', kind: 'HARDWARE', status: 'SUBMITTED', route: null, returnedReason: null, managerId: 'mgr-1', gmId: 'gm-1', requesterId: 'req-1',
    signed: { manager: false, gm: false }, hasOpenSchedule: false, ...over,
});
const IT = { userId: 'it-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT };

describe('listFieldsOf', () => {
    it('gives the kind, phase, label and paused flag of a request ticket', () => {
        expect(listFieldsOf(row({ status: 'AWAITING_DELIVERY' }), IT)).toMatchObject({
            requestKind: 'HARDWARE', flowPhase: 'delivery', flowPhaseLabel: 'Menunggu barang tiba', flowPaused: true,
        });
        expect(listFieldsOf(row({ status: 'INSTALLATION' }), IT)).toMatchObject({ flowPhase: 'schedule', flowPaused: false });
        expect(listFieldsOf(row({ status: 'INSTALLATION', hasOpenSchedule: true }), IT)).toMatchObject({ flowPhase: 'install' });
    });

    it('an e-form uses its own statuses', () => {
        expect(listFieldsOf(row({ kind: 'EFORM', status: 'PENDING_GM' }), IT)).toMatchObject({ requestKind: 'EFORM', flowPhase: 'appr_gm', flowPaused: true });
    });

    it('needsMyAction: the approver whose turn it is, IT on its own phases, the requester when asked to confirm', () => {
        const waitingManager = row({ status: 'UNDER_REVIEW', route: 'MANAGER' });
        expect(listFieldsOf(waitingManager, { userId: 'mgr-1', role: UserRole.MANAGER }).needsMyAction).toBe(true);
        expect(listFieldsOf(waitingManager, { userId: 'gm-1', role: UserRole.MANAGER }).needsMyAction).toBe(false);
        expect(listFieldsOf(waitingManager, IT).needsMyAction).toBe(false);
        expect(listFieldsOf(row({ status: 'SUBMITTED' }), IT).needsMyAction).toBe(true);
        expect(listFieldsOf(row({ status: 'AWAITING_USER_CONFIRMATION' }), { userId: 'req-1', role: UserRole.USER }).needsMyAction).toBe(true);
        expect(listFieldsOf(row({ status: 'AWAITING_USER_CONFIRMATION' }), IT).needsMyAction).toBe(false);
        expect(listFieldsOf(row({ status: 'COMPLETED' }), IT).needsMyAction).toBe(false);
    });
});

describe('loadFlowListFields', () => {
    it('ordinary tickets get null fields and cost no query', async () => {
        const manager = { query: jest.fn(async () => []) };
        const map = await loadFlowListFields(manager as never, [{ id: 'a', ticketType: 'SERVICE' }, { id: 'b', ticketType: null }], IT);
        expect(manager.query).not.toHaveBeenCalled();
        expect(map.get('a')).toEqual({ requestKind: null, flowPhase: null, flowPhaseLabel: null, flowPaused: false, needsMyAction: false });
    });

    it('reads every request of the page in one batch', async () => {
        const manager = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('request_flows')) return [{ ticketId: 't-1', kind: 'HARDWARE', status: 'APPROVED', route: 'MANAGER', returnedReason: null, managerId: 'm', gmId: null, requesterId: 'r', managerSigned: true, gmSigned: false, hasOpenSchedule: false }];
                return [];
            }),
        };
        const map = await loadFlowListFields(manager as never, [{ id: 't-1', ticketType: 'HARDWARE_REQUEST' }], IT);
        expect(manager.query).toHaveBeenCalledTimes(1);
        expect(map.get('t-1')).toMatchObject({ requestKind: 'HARDWARE', flowPhase: 'procure', needsMyAction: true });
    });
});
