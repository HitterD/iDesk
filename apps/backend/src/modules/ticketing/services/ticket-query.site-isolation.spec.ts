import { TicketQueryService } from './ticket-query.service';
import { UserRole } from '../../users/enums/user-role.enum';

const OWN_SITE = 'ticket.siteId = :userSiteId';
const MATCH_NOTHING = '1 = 0';

const SITE_LOCKED_ROLES = [
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ADMIN,
    UserRole.AGENT,
    UserRole.USER,
];

const CROSS_SITE_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT_ORACLE];

describe('TicketQueryService site isolation', () => {
    let service: any;
    let mockQueryBuilder: any;
    let cacheService: any;

    beforeEach(() => {
        // Terminal methods resolve; every other builder method chains. A Proxy
        // keeps this spec from breaking each time the service uses one more
        // QueryBuilder method it did not use before.
        const terminals: Record<string, unknown> = {
            getRawOne: {},
            getRawMany: [],
            getManyAndCount: [[], 0],
            getMany: [],
            getCount: 0,
        };
        const chainSpies = new Map<string, jest.Mock>();
        mockQueryBuilder = new Proxy({} as any, {
            get(_target, prop: string) {
                if (prop in terminals) return jest.fn().mockResolvedValue(terminals[prop]);
                if (!chainSpies.has(prop)) {
                    chainSpies.set(prop, jest.fn(() => mockQueryBuilder));
                }
                return chainSpies.get(prop);
            },
        });

        cacheService = { getOrSet: jest.fn((_key: string, fn: any) => fn()) };

        service = new TicketQueryService(
            { createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder) } as any,
            {} as any,
            cacheService as any,
        );
    });

    describe('paginated list', () => {
        it.each(SITE_LOCKED_ROLES)('pins %s to their own site', async (role) => {
            await service.findAllPaginated('user-1', role, 'site-spj');

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(OWN_SITE, {
                userSiteId: 'site-spj',
            });
        });

        it.each(SITE_LOCKED_ROLES)(
            'ignores a foreign siteId filter supplied by %s',
            async (role) => {
                await service.findAllPaginated('user-1', role, 'site-spj', {
                    siteId: 'site-smg',
                });

                expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(OWN_SITE, {
                    userSiteId: 'site-spj',
                });
                expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
                    'ticket.siteId = :siteId',
                    { siteId: 'site-smg' },
                );
            },
        );

        it.each(SITE_LOCKED_ROLES)(
            'matches nothing for %s when the account has no site (fail-closed)',
            async (role) => {
                await service.findAllPaginated('user-1', role, null);

                expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(MATCH_NOTHING);
            },
        );

        it.each(CROSS_SITE_ROLES)('leaves %s unrestricted by site', async (role) => {
            await service.findAllPaginated('user-1', role, null);

            expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(MATCH_NOTHING);
            expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
                OWN_SITE,
                expect.anything(),
            );
        });

        it.each(CROSS_SITE_ROLES)('lets %s narrow to chosen sites', async (role) => {
            await service.findAllPaginated('user-1', role, null, {
                siteIds: ['site-spj', 'site-smg'],
            });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'ticket.siteId IN (:...siteIds)',
                { siteIds: ['site-spj', 'site-smg'] },
            );
        });
    });

    describe('unpaginated list', () => {
        it('pins a site-locked agent to their own site', async () => {
            await service.findAll('user-1', UserRole.AGENT_OPERATIONAL_SUPPORT, 'site-spj');

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(OWN_SITE, {
                userSiteId: 'site-spj',
            });
        });

        it('matches nothing for a site-locked agent without a site', async () => {
            await service.findAll('user-1', UserRole.AGENT_OPERATIONAL_SUPPORT, null);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(MATCH_NOTHING);
        });

        it('leaves ADMIN unrestricted', async () => {
            await service.findAll('user-1', UserRole.ADMIN, null);

            expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(MATCH_NOTHING);
        });
    });

    describe('Oracle queue', () => {
        it('still pins a site-locked caller to their own site', async () => {
            await service.findAllPaginatedOracle('user-1', UserRole.AGENT_ADMIN, 'site-spj');

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(OWN_SITE, {
                userSiteId: 'site-spj',
            });
        });

        it('leaves AGENT_ORACLE cross-site, since Oracle/K2 is centralised', async () => {
            await service.findAllPaginatedOracle('user-1', UserRole.AGENT_ORACLE, 'site-spj');

            expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
                OWN_SITE,
                expect.anything(),
            );
        });
    });

    describe('dashboard stats', () => {
        it('scopes the aggregates to a site-locked agent site', async () => {
            await service.getDashboardStats(
                'user-1',
                UserRole.AGENT_OPERATIONAL_SUPPORT,
                'site-spj',
            );

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(OWN_SITE, {
                userSiteId: 'site-spj',
            });
        });

        it('keys the cache per site so one site never serves another numbers', async () => {
            await service.getDashboardStats('a', UserRole.AGENT_OPERATIONAL_SUPPORT, 'site-spj');
            await service.getDashboardStats('b', UserRole.AGENT_OPERATIONAL_SUPPORT, 'site-smg');

            const [spjKey] = cacheService.getOrSet.mock.calls[0];
            const [smgKey] = cacheService.getOrSet.mock.calls[1];

            expect(spjKey).toContain('site-spj');
            expect(smgKey).toContain('site-smg');
            expect(spjKey).not.toEqual(smgKey);
        });

        it('shares one cache key across cross-site roles', async () => {
            await service.getDashboardStats('a', UserRole.ADMIN, null);
            await service.getDashboardStats('b', UserRole.ADMIN, 'site-spj');

            const [firstKey] = cacheService.getOrSet.mock.calls[0];
            const [secondKey] = cacheService.getOrSet.mock.calls[1];

            expect(firstKey).toEqual(secondKey);
        });

        it('matches nothing for an agent without a site', async () => {
            await service.getDashboardStats('user-1', UserRole.AGENT_OPERATIONAL_SUPPORT, null);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(MATCH_NOTHING);
        });
    });
});
