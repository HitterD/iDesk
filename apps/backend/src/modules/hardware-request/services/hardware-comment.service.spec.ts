import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareCommentService } from './hardware-comment.service';
import { HardwareRequestComment } from '../domain/entities/hardware-request-comment.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestActivity } from '../domain/entities/hardware-request-activity.entity';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('HardwareCommentService', () => {
    let service: HardwareCommentService;
    let commentRepo: any;
    let requestRepo: any;
    let activityRepo: any;
    let ds: any;

    beforeEach(async () => {
        commentRepo = {
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve({ id: 'c1', ...x, createdAt: new Date() })),
            find: jest.fn(),
            findOne: jest.fn(),
        };
        requestRepo = { findOne: jest.fn() };
        activityRepo = {
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve(x)),
            find: jest.fn().mockResolvedValue([]),
        };
        ds = {
            transaction: (cb: any) => cb({
                getRepository: (e: any) =>
                    e === HardwareRequestComment ? commentRepo :
                    e === HardwareRequestActivity ? activityRepo : requestRepo,
            }),
        };
        const moduleRef = await Test.createTestingModule({
            providers: [
                HardwareCommentService,
                { provide: getRepositoryToken(HardwareRequestComment), useValue: commentRepo },
                { provide: getRepositoryToken(HardwareRequest), useValue: requestRepo },
                { provide: getRepositoryToken(HardwareRequestActivity), useValue: activityRepo },
                { provide: DataSource, useValue: ds },
                { provide: EventEmitter2, useValue: { emit: jest.fn() } },
            ],
        }).compile();
        service = moduleRef.get(HardwareCommentService);
    });

    it('add creates comment + activity when user owns request', async () => {
        requestRepo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'u1' });
        const res = await service.add(
            { id: 'u1', role: HardwareRole.USER }, 'r1',
            { body: 'Hi' },
        );
        expect(res.id).toBe('c1');
        expect(activityRepo.save).toHaveBeenCalled();
    });

    it('add forbids non-requester USER', async () => {
        requestRepo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'owner' });
        await expect(
            service.add({ id: 'other', role: HardwareRole.USER }, 'r1', { body: 'x' }),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }) });
    });

    it('list returns non-deleted comments sorted asc', async () => {
        requestRepo.findOne.mockResolvedValue({ id: 'r1' });
        commentRepo.find.mockResolvedValue([{ id: 'c1', createdAt: new Date() }]);
        const res = await service.list(
            { id: 'lead', role: HardwareRole.ICT_STAFF }, 'r1',
        );
        expect(commentRepo.find).toHaveBeenCalledWith({
            where: { requestId: 'r1', deletedAt: expect.anything() },
            order: { createdAt: 'DESC' },
            relations: { author: true },
        });
        expect(res).toHaveLength(1);
    });

    it('edit allowed within 15min by author only', async () => {
        const now = new Date();
        const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
        commentRepo.findOne.mockResolvedValue({
            id: 'c1', authorId: 'u1', createdAt: tenMinAgo, body: 'old', request: { id: 'r1' },
        });
        const res = await service.edit(
            { id: 'u1', role: HardwareRole.USER }, 'r1', 'c1', { body: 'new' },
        );
        expect(res.body).toBe('new');
        expect(res.editedAt).toBeInstanceOf(Date);
    });

    it('edit rejects after 15min', async () => {
        const old = new Date(Date.now() - 20 * 60 * 1000);
        commentRepo.findOne.mockResolvedValue({
            id: 'c1', authorId: 'u1', createdAt: old, body: 'old',
        });
        await expect(
            service.edit({ id: 'u1', role: HardwareRole.USER }, 'r1', 'c1', { body: 'new' }),
        ).rejects.toThrow(/edit window/i);
    });

    it('softDelete by author works', async () => {
        commentRepo.findOne.mockResolvedValue({ id: 'c1', authorId: 'u1' });
        await service.softDelete(
            { id: 'u1', role: HardwareRole.USER }, 'r1', 'c1',
        );
        expect(commentRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'c1', deletedAt: expect.any(Date) }),
        );
    });

    it('softDelete by ICT_STAFF works even if not author', async () => {
        commentRepo.findOne.mockResolvedValue({ id: 'c1', authorId: 'other' });
        await service.softDelete(
            { id: 'lead', role: HardwareRole.ICT_STAFF }, 'r1', 'c1',
        );
        expect(commentRepo.save).toHaveBeenCalled();
    });

    it('softDelete denies non-author non-lead', async () => {
        commentRepo.findOne.mockResolvedValue({ id: 'c1', authorId: 'other' });
        await expect(
            service.softDelete({ id: 'u1', role: HardwareRole.USER }, 'r1', 'c1'),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }) });
    });
});
