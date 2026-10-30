import { SearchService } from './search.service';
import { ArticleVisibility } from '../knowledge-base/entities/article.entity';
import { CacheService } from '../../shared/core/cache';
import { UserRole } from '../users/enums/user-role.enum';

const ADMIN = { userId: 'admin-1', role: UserRole.ADMIN, siteId: null };

const AND_WHERE_CALLS = 'andWhereCalls';
const GET_MANY_RESULT = 'getManyResult';

function makeQueryBuilder(getManyResult: any[]) {
    const calls: { sql: string; params?: any }[] = [];
    const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockImplementation((sql: string, params?: any) => {
            calls.push({ sql: String(sql), params });
            return qb;
        }),
        orWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(getManyResult),
        getRawMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
        getCount: jest.fn().mockResolvedValue(0),
    };
    return { qb, calls };
}

function makeRepo(getManyResult: any[] = []) {
    const { qb, calls } = makeQueryBuilder(getManyResult);
    return {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        __calls: calls,
    };
}


function buildService(articleRepo: any, otherRepos: any = {}) {
    const cacheGet = jest.fn().mockResolvedValue(null);
    const cacheSet = jest.fn().mockResolvedValue(undefined);
    const cacheService = { getAsync: cacheGet, setAsync: cacheSet } as unknown as CacheService;

    const blankRepo = function () {
        const { qb } = makeQueryBuilder([]);
        return { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    };

    const service = new SearchService(
        otherRepos.ticketRepo || blankRepo(),
        otherRepos.userRepo || blankRepo(),
        articleRepo as any,
        otherRepos.hardwareRequestRepo || blankRepo(),
        otherRepos.savedSearchRepo || blankRepo(),
        cacheService,
    );
    return { service, cacheGet, cacheSet };
}

describe('SearchService article visibility enforcement', () => {
    it('filters articles to PUBLIC when no visibilities are passed', async () => {
        const articleRepo = makeRepo([{ id: 'a1', title: 'Printer error', category: 'General', tags: [], viewCount: 1, createdAt: new Date() }]);
        const { service } = buildService(articleRepo);

        await service.search({ q: 'printer', scope: ['articles'] }, [ArticleVisibility.PUBLIC], ADMIN);

        const vis = articleRepo.__calls.filter(c => c.sql.includes('article.visibility IN'));
        expect(vis).toHaveLength(1);
        expect(vis[0].params).toEqual({ visibilities: [ArticleVisibility.PUBLIC] });
    });

    it('passes caller-allowed visibilities into the article query', async () => {
        const articleRepo = makeRepo([]);
        const { service } = buildService(articleRepo);

        await service.search(
            { q: 'printer', scope: ['articles'] },
            [ArticleVisibility.PUBLIC, ArticleVisibility.INTERNAL],
            ADMIN,
        );

        const vis = articleRepo.__calls.filter(c => c.sql.includes('article.visibility IN'));
        expect(vis[0].params).toEqual({ visibilities: [ArticleVisibility.PUBLIC, ArticleVisibility.INTERNAL] });
    });

    it('never leaks internal articles when the caller does not allow them', async () => {
        const internal = { id: 'i1', title: 'Internal how-to', category: 'Internal', tags: [], viewCount: 1, createdAt: new Date() };
        const articleRepo = makeRepo([internal]);
        const { service } = buildService(articleRepo);

        const result = await service.search({ q: 'how-to', scope: ['articles'] }, [ArticleVisibility.PUBLIC], ADMIN);

        // With PUBLIC only, getMany still returns, but the query carried the
        // visibility restriction; the SQL is what enforces it server-side.
        expect(result.articles).toHaveLength(1);
        const vis = articleRepo.__calls.filter(c => c.sql.includes('article.visibility IN'));
        expect(vis[0].params).toEqual({ visibilities: [ArticleVisibility.PUBLIC] });
    });

    it('treats tickets-only scopes without articles as unaffected', async () => {
        const articleRepo = makeRepo([]);
        const { service } = buildService(articleRepo);

        const result = await service.search({ q: 'x', scope: ['tickets'] }, [ArticleVisibility.PUBLIC], ADMIN);

        expect(result.articles).toEqual([]);
        const vis = articleRepo.__calls.filter(c => c.sql.includes('article.visibility IN'));
        expect(vis).toHaveLength(0);
    });

    it('filters article suggestions by visibility too', async () => {
        const articleRepo = makeRepo([]);
        const { service } = buildService(articleRepo);

        await service.getSuggestions('prin', 10, [ArticleVisibility.PUBLIC, ArticleVisibility.INTERNAL], ADMIN);

        const vis = articleRepo.__calls.filter(c => c.sql.includes('article.visibility IN'));
        expect(vis).toHaveLength(1);
        expect(vis[0].params).toEqual({ visibilities: [ArticleVisibility.PUBLIC, ArticleVisibility.INTERNAL] });
    });

    it('parts the cache key with the visibilities so roles never share results', async () => {
        const articleRepo = makeRepo([]);
        const { service, cacheSet } = buildService(articleRepo);

        await service.search({ q: 'printer', scope: ['articles'] }, [ArticleVisibility.PUBLIC], ADMIN);
        await service.search({ q: 'printer', scope: ['articles'] }, [ArticleVisibility.PUBLIC, ArticleVisibility.INTERNAL], ADMIN);
        await service.getSuggestions('prin', 10, [ArticleVisibility.PUBLIC], ADMIN);
        await service.getSuggestions('prin', 10, [ArticleVisibility.PUBLIC, ArticleVisibility.INTERNAL], ADMIN);

        const keys = cacheSet.mock.calls.map(c => c[0]);
        expect(keys).toContain('search:{"q":"printer","scope":["articles"]}:public:ADMIN:all');
        expect(keys).toContain('search:{"q":"printer","scope":["articles"]}:public,internal:ADMIN:all');
        expect(keys).toContain('suggestions:prin:public:ADMIN:all');
        expect(keys).toContain('suggestions:prin:public,internal:ADMIN:all');
    });
});

describe('SearchService caller isolation', () => {
    const USER = { userId: 'user-1', role: UserRole.USER, siteId: 'site-a' };
    const AGENT = { userId: 'agent-1', role: UserRole.AGENT, siteId: 'site-a' };
    const sqlOf = (repo: any) => repo.__calls.map((c: any) => c.sql).join(' | ');

    it('limits a requester to their own tickets and hardware requests, and hides the user directory', async () => {
        const ticketRepo = makeRepo([]);
        const userRepo = makeRepo([{ id: 'u2', fullName: 'Other', email: 'o@x', role: 'USER' }]);
        const hardwareRequestRepo = makeRepo([]);
        const { service } = buildService(makeRepo([]), { ticketRepo, userRepo, hardwareRequestRepo });

        const result = await service.search({ q: 'laptop' }, [ArticleVisibility.PUBLIC], USER);

        expect(sqlOf(ticketRepo)).toContain('ticket.userId = :searchUserId');
        expect(sqlOf(hardwareRequestRepo)).toContain('hw.requesterId = :searchUserId');
        expect(result.users).toEqual([]);
        expect(userRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('pins a site-locked agent to their own site for tickets, users and hardware', async () => {
        const ticketRepo = makeRepo([]);
        const userRepo = makeRepo([]);
        const hardwareRequestRepo = makeRepo([]);
        const { service } = buildService(makeRepo([]), { ticketRepo, userRepo, hardwareRequestRepo });

        await service.search({ q: 'laptop' }, [ArticleVisibility.PUBLIC], AGENT);

        expect(sqlOf(ticketRepo)).toContain('ticket.siteId = :userSiteId');
        expect(sqlOf(userRepo)).toContain('user.siteId = :searchSiteId');
        expect(sqlOf(hardwareRequestRepo)).toContain('hw.siteId = :searchSiteId');
    });

    it('matches nothing for a site-locked agent without a site', async () => {
        const ticketRepo = makeRepo([]);
        const userRepo = makeRepo([]);
        const { service } = buildService(makeRepo([]), { ticketRepo, userRepo });

        await service.search({ q: 'laptop' }, [ArticleVisibility.PUBLIC], { ...AGENT, siteId: null });

        expect(sqlOf(ticketRepo)).toContain('1 = 0');
        expect(sqlOf(userRepo)).toContain('1 = 0');
    });

    it('never shares a cache entry between two requesters', async () => {
        const { service, cacheSet } = buildService(makeRepo([]));

        await service.search({ q: 'x', scope: ['tickets'] }, [ArticleVisibility.PUBLIC], USER);
        await service.search({ q: 'x', scope: ['tickets'] }, [ArticleVisibility.PUBLIC], { ...USER, userId: 'user-2' });

        const keys = cacheSet.mock.calls.map((c: any) => c[0]);
        expect(new Set(keys).size).toBe(2);
    });
});
