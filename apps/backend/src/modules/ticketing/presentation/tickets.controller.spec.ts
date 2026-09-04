import { TicketsController } from './tickets.controller';

describe('TicketsController', () => {
    let controller: any;
    let mockTicketCreateService: any;
    let mockTicketUpdateService: any;
    let mockTicketMessagingService: any;
    let mockTicketQueryService: any;
    let mockTicketMergeService: any;
    let mockTicketParticipantService: any;
    let mockTicketStatsService: any;
    let mockTicketSlaExtendService: any;
    let mockTicketForwardService: any;
    let mockTicketReminderService: any;
    let mockKbService: any;

    beforeEach(() => {
        mockTicketParticipantService = {};
        mockTicketSlaExtendService = { extendSla: jest.fn().mockResolvedValue({}) };
        mockTicketForwardService = { forwardTicket: jest.fn().mockResolvedValue({}) };
        mockTicketReminderService = { createReminder: jest.fn(), getReminders: jest.fn(), deleteReminder: jest.fn() };
        mockKbService = { suggestForTicket: jest.fn().mockResolvedValue([]) };
        mockTicketStatsService = {
            getHardwareInstallationStats: jest.fn().mockResolvedValue({
                total: 10,
                pending: 3,
                inProgress: 5,
                completed: 2
            })
        };

        controller = new TicketsController(
            mockTicketCreateService,
            mockTicketUpdateService,
            mockTicketMessagingService,
            mockTicketQueryService,
            mockTicketMergeService,
            mockTicketParticipantService,
            mockTicketStatsService,
            mockTicketSlaExtendService,
            mockTicketForwardService,
            mockTicketReminderService,
            mockKbService
        );
    });

    it('should return hardware stats', async () => {
        const req = { user: { userId: 'user1', role: 'ADMIN' } };
        const stats = await controller.getHardwareStats(req);
        
        expect(mockTicketStatsService.getHardwareInstallationStats).toHaveBeenCalledWith('user1');
        expect(stats).toEqual({
            total: 10,
            pending: 3,
            inProgress: 5,
            completed: 2
        });
    });
});