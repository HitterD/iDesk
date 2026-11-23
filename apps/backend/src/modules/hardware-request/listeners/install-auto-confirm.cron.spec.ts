import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InstallAutoConfirmCron } from './install-auto-confirm.cron';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestCommandService } from '../services/hardware-request-command.service';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { RequestFlowMembership } from '../services/request-flow-membership.service';

describe('InstallAutoConfirmCron', () => {
    let cron: InstallAutoConfirmCron;
    const repo = { find: jest.fn() };
    const cmdSvc = { autoConfirmInstallation: jest.fn() };
    const flows = { has: jest.fn(async (_id: string) => false) };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                InstallAutoConfirmCron,
                { provide: getRepositoryToken(HardwareRequest), useValue: repo },
                { provide: HardwareRequestCommandService, useValue: cmdSvc },
                { provide: RequestFlowMembership, useValue: flows },
            ],
        }).compile();
        cron = mod.get(InstallAutoConfirmCron);
        jest.clearAllMocks();
        flows.has.mockImplementation(async () => false);
    });

    it('does nothing when no requests are awaiting user confirmation after TTL', async () => {
        repo.find.mockResolvedValue([]);
        await cron.run();
        expect(cmdSvc.autoConfirmInstallation).not.toHaveBeenCalled();
    });

    it('auto confirms requests exceeding TTL and passes without error', async () => {
        repo.find.mockResolvedValue([{ id: 'req-1' }, { id: 'req-2' }]);
        cmdSvc.autoConfirmInstallation.mockResolvedValue({});

        await cron.run();

        expect(cmdSvc.autoConfirmInstallation).toHaveBeenCalledTimes(2);
        expect(cmdSvc.autoConfirmInstallation).toHaveBeenNthCalledWith(1, 'req-1');
        expect(cmdSvc.autoConfirmInstallation).toHaveBeenNthCalledWith(2, 'req-2');
    });

    it('handles errors gracefully during auto confirmation loop', async () => {
        repo.find.mockResolvedValue([{ id: 'req-1' }, { id: 'req-2' }]);
        cmdSvc.autoConfirmInstallation
            .mockRejectedValueOnce(new Error('DB error'))
            .mockResolvedValueOnce({});

        await cron.run();

        expect(cmdSvc.autoConfirmInstallation).toHaveBeenCalledTimes(2);
    });

    it('leaves request-flow requests to the ticket auto-close (its 540 business-minute window decides)', async () => {
        repo.find.mockResolvedValue([{ id: 'flow-req' }, { id: 'legacy-req' }]);
        flows.has.mockImplementation(async (id: string) => id === 'flow-req');
        cmdSvc.autoConfirmInstallation.mockResolvedValue({});

        await cron.run();

        expect(cmdSvc.autoConfirmInstallation).toHaveBeenCalledTimes(1);
        expect(cmdSvc.autoConfirmInstallation).toHaveBeenCalledWith('legacy-req');
    });
});
