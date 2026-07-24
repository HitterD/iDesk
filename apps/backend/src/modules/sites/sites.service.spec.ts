import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SitesService } from './sites.service';
import { Site } from './entities/site.entity';
import { User } from '../users/entities/user.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { CacheService } from '../../shared/core/cache';

describe('SitesService — TV token', () => {
    let service: SitesService;
    let siteRepo: { findOne: jest.Mock; save: jest.Mock };
    let auditService: { logAsync: jest.Mock };
    let cacheService: { getOrSet: jest.Mock; delAsync: jest.Mock };

    beforeEach(async () => {
        siteRepo = {
            findOne: jest.fn(),
            save: jest.fn(async (site) => site),
        };
        auditService = { logAsync: jest.fn() };
        cacheService = {
            getOrSet: jest.fn(),
            delAsync: jest.fn().mockResolvedValue(undefined),
        };

        const module = await Test.createTestingModule({
            providers: [
                SitesService,
                { provide: getRepositoryToken(Site), useValue: siteRepo },
                { provide: getRepositoryToken(User), useValue: {} },
                { provide: getRepositoryToken(Ticket), useValue: {} },
                { provide: AuditService, useValue: auditService },
                { provide: CacheService, useValue: cacheService },
            ],
        }).compile();
        service = module.get(SitesService);
    });

    it('generates a new random token, overwriting any existing one', async () => {
        siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'SPJ', code: 'SPJ', tvToken: 'old-token' });

        const result = await service.generateTvToken('site-1', 'admin-1');

        expect(result.tvToken).toBeDefined();
        expect(result.tvToken).not.toBe('old-token');
        expect(auditService.logAsync).toHaveBeenCalledWith(expect.objectContaining({
            action: AuditAction.SITE_TV_TOKEN_GENERATE,
            entityId: 'site-1',
        }));
    });

    it('revokes token by setting it to null', async () => {
        siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'SPJ', code: 'SPJ', tvToken: 'active-token' });

        const result = await service.revokeTvToken('site-1', 'admin-1');

        expect(result.tvToken).toBeNull();
        expect(auditService.logAsync).toHaveBeenCalledWith(expect.objectContaining({
            action: AuditAction.SITE_TV_TOKEN_REVOKE,
            entityId: 'site-1',
        }));
    });

    it('throws NotFoundException when site does not exist', async () => {
        siteRepo.findOne.mockResolvedValue(null);

        await expect(service.generateTvToken('missing-id')).rejects.toThrow(NotFoundException);
    });
});
