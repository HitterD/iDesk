import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

describe('AuditService', () => {
    let service: AuditService;
    let mockRepo: any;

    beforeEach(async () => {
        mockRepo = {
            create: jest.fn().mockImplementation(dto => dto),
            save: jest.fn().mockImplementation(dto => Promise.resolve({ id: 'log-1', ...dto, createdAt: new Date() })),
            createQueryBuilder: jest.fn(),
            find: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditService,
                {
                    provide: getRepositoryToken(AuditLog),
                    useValue: mockRepo,
                },
            ],
        }).compile();

        service = module.get<AuditService>(AuditService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should log audit event with extracted client IP from X-Forwarded-For', async () => {
        const mockRequest: any = {
            headers: {
                'x-forwarded-for': '203.0.113.195, 192.168.127.1',
                'user-agent': 'Mozilla/5.0 Chrome/120.0',
            },
            socket: { remoteAddress: '192.168.127.1' },
        };

        await service.log({
            userId: 'user-123',
            action: AuditAction.USER_LOGIN,
            entityType: 'auth',
            entityId: 'user-123',
            description: 'User logged in',
            request: mockRequest,
        });

        expect(mockRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-123',
                action: AuditAction.USER_LOGIN,
                entityType: 'auth',
                ipAddress: '203.0.113.195',
                userAgent: 'Mozilla/5.0 Chrome/120.0',
            })
        );
        expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should log audit event with X-Real-IP when X-Forwarded-For is absent', async () => {
        const mockRequest: any = {
            headers: {
                'x-real-ip': '10.20.30.40',
            },
            socket: { remoteAddress: '192.168.127.1' },
        };

        await service.log({
            userId: 'user-123',
            action: AuditAction.USER_LOGOUT,
            entityType: 'auth',
            request: mockRequest,
        });

        expect(mockRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                ipAddress: '10.20.30.40',
            })
        );
    });

    it('should log null ipAddress when request is not provided', async () => {
        await service.log({
            userId: 'user-123',
            action: AuditAction.UPDATE_TICKET,
            entityType: 'ticket',
        });

        expect(mockRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                ipAddress: null,
                userAgent: null,
            })
        );
    });
});
