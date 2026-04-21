import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InstallationScheduleService } from './installation-schedule.service';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { InstallStatus } from '../domain/enums/install-status.enum';
import { HardwareActivityService } from './hardware-activity.service';

describe('InstallationScheduleService', () => {
    let svc: InstallationScheduleService;
    const scheduleRepo = {
        findOne: jest.fn(),
        create: jest.fn(v => v),
        save: jest.fn(v => ({ ...v, id: 'sch-1' })),
        createQueryBuilder: jest.fn(),
    };
    const requestRepo = { findOne: jest.fn(), save: jest.fn(v => v) };
    const activity = { log: jest.fn() };
    const emitter = { emit: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                InstallationScheduleService,
                { provide: getRepositoryToken(InstallationSchedule), useValue: scheduleRepo },
                { provide: getRepositoryToken(HardwareRequest), useValue: requestRepo },
                { provide: HardwareActivityService, useValue: activity },
                { provide: EventEmitter2, useValue: emitter },
            ],
        }).compile();
        svc = mod.get(InstallationScheduleService);
        jest.clearAllMocks();
    });

    describe('propose', () => {
        it('creates PROPOSED when none exists, request in INSTALLATION', async () => {
            requestRepo.findOne.mockResolvedValue({
                id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1',
            });
            scheduleRepo.findOne.mockResolvedValue(null);

            const res = await svc.propose('r1', {
                technicianId: 't1',
                scheduledStart: '2026-05-01T09:00:00Z',
                scheduledEnd: '2026-05-01T11:00:00Z',
            }, { id: 'u1', role: 'USER' });

            expect(res.status).toBe(InstallStatus.PROPOSED);
            expect(res.proposedBy).toBe('u1');
            expect(emitter.emit).toHaveBeenCalledWith(
                'hardware-request.schedule.proposed', expect.objectContaining({ requestId: 'r1' }),
            );
        });

        it('rejects when end ≤ start', async () => {
            requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION });
            await expect(svc.propose('r1', {
                scheduledStart: '2026-05-01T11:00:00Z',
                scheduledEnd: '2026-05-01T10:00:00Z',
                technicianId: 't1',
            }, { id: 'u1', role: 'USER' })).rejects.toThrow(/end must be after start/i);
        });

        it('rejects when request status != INSTALLATION', async () => {
            requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.PROCUREMENT });
            await expect(svc.propose('r1', {
                scheduledStart: '2026-05-01T09:00:00Z',
                scheduledEnd: '2026-05-01T10:00:00Z',
                technicianId: 't1',
            }, { id: 'u1', role: 'USER' })).rejects.toThrow(/invalid state/i);
        });
    });

    describe('confirm', () => {
        it('confirms by counterparty; sets CONFIRMED + confirmedBy ≠ proposedBy', async () => {
            scheduleRepo.findOne.mockResolvedValue({
                id: 'sch-1', requestId: 'r1', status: InstallStatus.PROPOSED,
                proposedBy: 'u1', technicianId: 't1',
            });
            requestRepo.findOne.mockResolvedValue({
                id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1',
            });
            scheduleRepo.save.mockImplementation(v => v);

            const res = await svc.confirm('r1', { id: 't1', role: 'ICT_STAFF' });
            expect(res.status).toBe(InstallStatus.CONFIRMED);
            expect(res.confirmedBy).toBe('t1');
            expect(emitter.emit).toHaveBeenCalledWith('hardware-request.schedule.confirmed', expect.any(Object));
        });

        it('rejects same-person confirm', async () => {
            scheduleRepo.findOne.mockResolvedValue({
                id: 'sch-1', requestId: 'r1', status: InstallStatus.PROPOSED, proposedBy: 'u1', technicianId: 't1',
            });
            requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1' });
            await expect(svc.confirm('r1', { id: 'u1', role: 'USER' }))
                .rejects.toThrow(/counterparty/i);
        });

        it('rejects confirm when not in PROPOSED', async () => {
            scheduleRepo.findOne.mockResolvedValue({
                id: 'sch-1', requestId: 'r1', status: InstallStatus.CONFIRMED, proposedBy: 'u1', technicianId: 't1',
            });
            requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1' });
            await expect(svc.confirm('r1', { id: 't1', role: 'ICT_STAFF' }))
                .rejects.toThrow(/invalid state/i);
        });
    });

    describe('reschedule', () => {
        it('marks old as RESCHEDULED and creates new PROPOSED', async () => {
            const old = { id: 'old', requestId: 'r1', status: InstallStatus.CONFIRMED, proposedBy: 'u1', technicianId: 't1' };
            // reschedule() uses createQueryBuilder to get latest schedule
            const qb = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([old]),
            };
            scheduleRepo.createQueryBuilder.mockReturnValue(qb);
            scheduleRepo.findOne.mockResolvedValue(old); // fallback findOne call
            requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1' });
            scheduleRepo.save.mockImplementation(v => ({ ...v, id: v.id ?? 'new' }));

            const res = await svc.reschedule('r1', {
                scheduledStart: '2026-05-02T09:00:00Z',
                scheduledEnd: '2026-05-02T11:00:00Z',
                reason: 'sick',
            }, { id: 't1', role: 'ICT_STAFF' });

            expect(old.status).toBe(InstallStatus.RESCHEDULED);
            expect(res.status).toBe(InstallStatus.PROPOSED);
            expect(emitter.emit).toHaveBeenCalledWith('hardware-request.schedule.rescheduled', expect.any(Object));
        });

        it('forbids reschedule after IN_PROGRESS', async () => {
            const inProgress = { id: 'old', requestId: 'r1', status: InstallStatus.IN_PROGRESS };
            const qb = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([inProgress]),
            };
            scheduleRepo.createQueryBuilder.mockReturnValue(qb);
            scheduleRepo.findOne.mockResolvedValue(inProgress);
            requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1' });
            await expect(svc.reschedule('r1', {
                scheduledStart: '2026-05-02T09:00:00Z', scheduledEnd: '2026-05-02T10:00:00Z',
            }, { id: 't1', role: 'ICT_STAFF' })).rejects.toThrow(/in progress/i);
        });
    });

    describe('startInstallation', () => {
        it('CONFIRMED → IN_PROGRESS by TECH owning the schedule', async () => {
            scheduleRepo.findOne.mockResolvedValue({
                id: 'sch-1', requestId: 'r1', status: InstallStatus.CONFIRMED, technicianId: 't1',
            });
            const res = await svc.startInstallation('r1', { id: 't1', role: 'ICT_STAFF' });
            expect(res.status).toBe(InstallStatus.IN_PROGRESS);
            expect(res.startedAt).toBeDefined();
        });
        it('rejects non-owner TECH', async () => {
            scheduleRepo.findOne.mockResolvedValue({
                id: 'sch-1', requestId: 'r1', status: InstallStatus.CONFIRMED, technicianId: 't1',
            });
            await expect(svc.startInstallation('r1', { id: 'tX', role: 'ICT_STAFF' }))
                .rejects.toThrow(/HR_PERMISSION_DENIED/);
        });
    });

    describe('completeInstallation', () => {
        it('IN_PROGRESS → DONE', async () => {
            scheduleRepo.findOne.mockResolvedValue({
                id: 'sch-1', requestId: 'r1', status: InstallStatus.IN_PROGRESS, technicianId: 't1',
            });
            requestRepo.findOne.mockResolvedValue({
                id: 'r1', status: RequestStatus.INSTALLATION,
                items: [{ deliveryStatus: 'ARRIVED' }],
                schedules: [{ status: InstallStatus.DONE }],
            });
            const res = await svc.completeInstallation('r1', { id: 't1', role: 'ICT_STAFF' });
            expect(res.status).toBe(InstallStatus.DONE);
            expect(res.completedAt).toBeDefined();
        });
    });
});
