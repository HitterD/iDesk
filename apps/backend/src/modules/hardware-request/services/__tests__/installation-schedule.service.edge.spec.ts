import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InstallationScheduleService, ActingUser } from '../installation-schedule.service';
import { InstallationSchedule } from '../../domain/entities/installation-schedule.entity';
import { HardwareRequest } from '../../domain/entities/hardware-request.entity';
import { HardwareActivityService } from '../hardware-activity.service';
import { RequestStatus } from '../../domain/enums/request-status.enum';
import { InstallStatus } from '../../domain/enums/install-status.enum';
import { ConflictException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('InstallationScheduleService Edge Cases', () => {
    let service: InstallationScheduleService;
    let repo: any;
    let reqRepo: any;
    let activityService: any;
    let emitter: any;

    beforeEach(async () => {
        repo = {
            create: jest.fn().mockImplementation((dto) => dto),
            save: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 's1', ...dto })),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
                andWhere: jest.fn().mockReturnThis(),
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                leftJoin: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([]),
            }),
        };

        reqRepo = {
            findOne: jest.fn(),
        };

        activityService = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        emitter = {
            emit: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InstallationScheduleService,
                { provide: getRepositoryToken(InstallationSchedule), useValue: repo },
                { provide: getRepositoryToken(HardwareRequest), useValue: reqRepo },
                { provide: HardwareActivityService, useValue: activityService },
                { provide: EventEmitter2, useValue: emitter },
            ],
        }).compile();

        service = module.get<InstallationScheduleService>(InstallationScheduleService);
    });

    const mockTech: ActingUser = { id: 't1', role: 'ICT_STAFF' };
    const mockUser: ActingUser = { id: 'u1', role: 'USER' };

    describe('confirm', () => {
        it('throws ConflictException if status is not PROPOSED', async () => {
            repo.findOne.mockResolvedValue({ status: InstallStatus.CONFIRMED, requestId: 'r1' });
            await expect(service.confirm('r1', mockTech)).rejects.toThrow(ConflictException);
        });
    });

    describe('reschedule', () => {
        it('throws ConflictException if schedule is already IN_PROGRESS', async () => {
            const start = new Date(Date.now() + 100000);
            const end = new Date(Date.now() + 200000);
            
            repo.createQueryBuilder().getMany.mockResolvedValue([{
                id: 's1', status: InstallStatus.IN_PROGRESS, requestId: 'r1'
            }]);
            repo.findOne.mockResolvedValue({ id: 's1', status: InstallStatus.IN_PROGRESS, requestId: 'r1' });

            await expect(service.reschedule('r1', { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString(), reason: 'changed' }, mockTech))
                .rejects.toThrow(ConflictException);
        });

        it('throws BadRequestException if end is before start', async () => {
            const start = new Date(Date.now() + 200000);
            const end = new Date(Date.now() + 100000);
            
            await expect(service.reschedule('r1', { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString(), reason: 'changed' }, mockTech))
                .rejects.toThrow(BadRequestException);
        });
    });

    describe('propose', () => {
        it('throws ConflictException if active schedule already exists', async () => {
            const start = new Date(Date.now() + 100000);
            const end = new Date(Date.now() + 200000);

            reqRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1' });
            repo.findOne.mockResolvedValue({ status: InstallStatus.PROPOSED, requestId: 'r1' });

            await expect(service.propose('r1', { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() }, mockTech))
                .rejects.toThrow(ConflictException);
        });
        
        it('throws BadRequestException if technicianId is not provided when proposer is USER', async () => {
            const start = new Date(Date.now() + 100000);
            const end = new Date(Date.now() + 200000);

            reqRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1' });
            repo.findOne.mockResolvedValue(null);

            await expect(service.propose('r1', { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() }, mockUser))
                .rejects.toThrow(BadRequestException);
        });
    });

    describe('calendar', () => {
        it('returns empty array if range is 0 days or no schedules match', async () => {
            const qb = repo.createQueryBuilder();
            qb.getMany.mockResolvedValue([]);
            const result = await service.calendar({ from: new Date().toISOString(), to: new Date().toISOString() });
            expect(result).toEqual([]);
        });
    });
});
