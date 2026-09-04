import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InstallAutoConfirmCron } from './install-auto-confirm.cron';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestCommandService } from '../services/hardware-request-command.service';
import { RequestStatus } from '../domain/enums/request-status.enum';

describe('InstallAutoConfirmCron', () => {
    let cron: InstallAutoConfirmCron;
    const repo = { find: jest.fn() };
    const cmdSvc = { autoConfirmInstallation: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                InstallAutoConfirmCron,
                { provide: getRepositoryToken(HardwareRequest), useValue: repo },
                { provide: HardwareRequestCommandService, useValue: cmdSvc },
            ],
        }).compile();
        cron = mod.get(InstallAutoConfirmCron);
        jest.clearAllMocks();
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
});
