import { WorkloadService } from './workload.service';
import { UserRole } from '../users/enums/user-role.enum';
import { TicketStatus } from '../ticketing/entities/ticket.entity';
import { SiteActor } from '../../shared/core/utils/site-scope.util';

/**
 * Workload points are read live from the PIC's tickets, never from the stored
 * daily row: a stored row written before a ticket moved to WAITING_VENDOR kept
 * counting it, which is what users saw on the Workload page.
 */
describe('WorkloadService — live workload points', () => {
    let service: WorkloadService;
    let workloadRepo: any;
    let ticketRepo: any;
    let userRepo: any;

    const adminActor: SiteActor = { role: UserRole.ADMIN, siteId: null };
    const agent = (id: string) => ({ id, fullName: `Agent ${id}`, email: `${id}@x.com`, role: UserRole.AGENT, siteId: 'site-1', site: { code: 'SPJ', name: 'Sepanjang' } });
    const ticket = (id: string, assignedToId: string, status: TicketStatus, priority = 'HIGH') =>
        ({ id, ticketNumber: id, title: id, priority, status, assignedToId, siteId: 'site-1', isHardwareInstallation: false, scheduledDate: null });

    // RM Bagastyo from the screenshot: 2 workable tickets, 3 waiting on a vendor.
    const bagastyoTickets = [
        ticket('t1', 'a1', TicketStatus.IN_PROGRESS, 'LOW'),
        ticket('t2', 'a1', TicketStatus.TODO, 'LOW'),
        ticket('v1', 'a1', TicketStatus.WAITING_VENDOR, 'HIGH'),
        ticket('v2', 'a1', TicketStatus.WAITING_VENDOR, 'HIGH'),
        ticket('v3', 'a1', TicketStatus.WAITING_VENDOR, 'HIGH'),
    ];

    const filterByStatus = (rows: any[]) => async ({ where }: any) => {
        const statuses: string[] = where.status?.value ?? [];
        return rows.filter(r => statuses.includes(r.status) && where.assignedToId.value.includes(r.assignedToId));
    };

    beforeEach(() => {
        workloadRepo = {
            // Stale stored row: still says 13 points / 5 active from before the vendor wait.
            find: jest.fn().mockResolvedValue([
                { agentId: 'a1', siteId: 'site-1', totalPoints: 13, activeTickets: 5, lastAssignedAt: null },
                { agentId: 'a2', siteId: 'site-1', totalPoints: 4, activeTickets: 1, lastAssignedAt: null },
            ]),
            save: jest.fn(async (rows: any) => rows),
            create: jest.fn((data: any) => data),
        };
        ticketRepo = { find: jest.fn() };
        userRepo = { find: jest.fn().mockResolvedValue([agent('a1'), agent('a2')]) };

        service = new WorkloadService(
            { logAsync: jest.fn() } as any,
            { find: jest.fn().mockResolvedValue([]) } as any,
            workloadRepo,
            ticketRepo,
            userRepo,
            { emit: jest.fn() } as any,
            {
                resolvePolicy: jest.fn().mockResolvedValue({ module: null, autoAssignEnabled: true, userIds: [], roles: [] }),
                toAssignable: jest.fn((t: any) => t),
            } as any,
        );
    });

    it('shows points and the workload count without waiting-vendor tickets, but still lists them under the PIC', async () => {
        ticketRepo.find.mockImplementation(filterByStatus([...bagastyoTickets, ticket('x1', 'a2', TicketStatus.TODO, 'HIGH')]));

        const [bagastyo] = await service.getAllAgentWorkloads(adminActor, 'site-1');

        // LOW = 1 point each; the three HIGH vendor tickets add nothing.
        expect(bagastyo.totalPoints).toBe(2);
        expect(bagastyo.activeTicketsCount).toBe(2);
        expect(bagastyo.waitingVendorCount).toBe(3);
        expect(bagastyo.activeTickets.map((t: any) => t.id)).toEqual(['t1', 't2', 'v1', 'v2', 'v3']);
    });

    it('picks the next PIC from live points, ignoring a stale stored row', async () => {
        // a1 has only vendor-wait tickets (0 live points); a2 has one HIGH ticket (4 points).
        ticketRepo.find.mockImplementation(filterByStatus([
            ticket('v1', 'a1', TicketStatus.WAITING_VENDOR, 'HIGH'),
            ticket('v2', 'a1', TicketStatus.WAITING_VENDOR, 'HIGH'),
            ticket('x1', 'a2', TicketStatus.TODO, 'HIGH'),
        ]));

        const best = await service.findBestAgentForAssignment('site-1');

        expect(best?.id).toBe('a1');
    });
});
