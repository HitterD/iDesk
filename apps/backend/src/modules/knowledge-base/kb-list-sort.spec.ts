import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KnowledgeBaseService, DEFAULT_ARTICLE_SORT, MAX_ARTICLE_PAGE_SIZE } from './knowledge-base.service';
import { Article, ArticleStatus, ArticleVisibility } from './entities/article.entity';
import { ArticleView } from './entities/article-view.entity';
import { AuditService } from '../audit/audit.service';

/** Minimal query-builder double recording what the service asked the DB for. */
const createQueryBuilder = () => {
    const calls = {
        orderBy: [] as Array<[string, string]>,
        addOrderBy: [] as Array<[string, string]>,
        where: [] as string[],
        skip: undefined as number | undefined,
        take: undefined as number | undefined,
    };
    const qb: any = {
        andWhere: jest.fn((clause: string) => { calls.where.push(clause); return qb; }),
        orderBy: jest.fn((c: string, d: string) => { calls.orderBy.push([c, d]); return qb; }),
        addOrderBy: jest.fn((c: string, d: string) => { calls.addOrderBy.push([c, d]); return qb; }),
        skip: jest.fn((n: number) => { calls.skip = n; return qb; }),
        take: jest.fn((n: number) => { calls.take = n; return qb; }),
        getMany: jest.fn(async () => []),
        getManyAndCount: jest.fn(async () => [[], 0]),
    };
    return { qb, calls };
};

describe('KnowledgeBaseService list ordering', () => {
    let service: KnowledgeBaseService;
    let builder: ReturnType<typeof createQueryBuilder>;

    beforeEach(async () => {
        builder = createQueryBuilder();
        const moduleRef = await Test.createTestingModule({
            providers: [
                KnowledgeBaseService,
                {
                    provide: getRepositoryToken(Article),
                    useValue: { createQueryBuilder: jest.fn(() => builder.qb) },
                },
                { provide: getRepositoryToken(ArticleView), useValue: {} },
                { provide: AuditService, useValue: { logAsync: jest.fn() } },
            ],
        }).compile();

        service = moduleRef.get(KnowledgeBaseService);
    });

    const baseFilters = {
        status: ArticleStatus.PUBLISHED,
        visibilities: [ArticleVisibility.PUBLIC],
    };

    it('orders by view count when sort is "popular"', async () => {
        await service.findAll({ ...baseFilters, sort: 'popular' });
        expect(builder.calls.orderBy).toEqual([['article.viewCount', 'DESC']]);
    });

    it('orders by last update when sort is "recent"', async () => {
        await service.findAll({ ...baseFilters, sort: 'recent' });
        expect(builder.calls.orderBy).toEqual([['article.updatedAt', 'DESC']]);
    });

    it('keeps the historic createdAt ordering when no sort is given', async () => {
        await service.findAll(baseFilters);
        expect(DEFAULT_ARTICLE_SORT).toBe('newest');
        expect(builder.calls.orderBy).toEqual([['article.createdAt', 'DESC']]);
    });

    it('falls back to the default instead of passing an unknown sort to SQL', async () => {
        await service.findAll({ ...baseFilters, sort: 'viewCount; DROP TABLE articles' as any });
        expect(builder.calls.orderBy).toEqual([['article.createdAt', 'DESC']]);
    });

    it('adds a stable tie-break so paging cannot repeat an article', async () => {
        await service.findAll({ ...baseFilters, sort: 'popular' });
        expect(builder.calls.addOrderBy).toEqual([['article.id', 'ASC']]);
    });

    it('excludes the pinned article only when asked', async () => {
        await service.findAll({ ...baseFilters, excludeFeatured: true });
        expect(builder.calls.where).toContain('article.isFeatured = false');

        const second = createQueryBuilder();
        (service as any).articleRepo.createQueryBuilder = jest.fn(() => second.qb);
        await service.findAll(baseFilters);
        expect(second.calls.where).not.toContain('article.isFeatured = false');
    });
});

describe('KnowledgeBaseService pagination', () => {
    let service: KnowledgeBaseService;
    let builder: ReturnType<typeof createQueryBuilder>;

    beforeEach(async () => {
        builder = createQueryBuilder();
        const moduleRef = await Test.createTestingModule({
            providers: [
                KnowledgeBaseService,
                {
                    provide: getRepositoryToken(Article),
                    useValue: { createQueryBuilder: jest.fn(() => builder.qb) },
                },
                { provide: getRepositoryToken(ArticleView), useValue: {} },
                { provide: AuditService, useValue: { logAsync: jest.fn() } },
            ],
        }).compile();
        service = moduleRef.get(KnowledgeBaseService);
    });

    it('caps the page size so a caller cannot request the whole table', async () => {
        await service.findAllPaginated({ limit: 10_000 });
        expect(builder.calls.take).toBe(MAX_ARTICLE_PAGE_SIZE);
    });

    it('clamps a negative or zero page size to at least one row', async () => {
        await service.findAllPaginated({ limit: 0, offset: -5 });
        expect(builder.calls.take).toBe(1);
        expect(builder.calls.skip).toBe(0);
    });

    it('reports hasMore while rows remain', async () => {
        builder.qb.getManyAndCount = jest.fn(async () => [[{ id: 'a' }, { id: 'b' }], 10]);
        const page = await service.findAllPaginated({ limit: 2, offset: 0 });
        expect(page).toEqual({ items: [{ id: 'a' }, { id: 'b' }], total: 10, hasMore: true });
    });

    it('reports hasMore false on the last page', async () => {
        builder.qb.getManyAndCount = jest.fn(async () => [[{ id: 'i' }], 5]);
        const page = await service.findAllPaginated({ limit: 2, offset: 4 });
        expect(page.hasMore).toBe(false);
    });
});
