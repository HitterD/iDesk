import { ArticleStatus, ArticleVisibility } from './entities/article.entity';
import { KnowledgeBaseService } from './knowledge-base.service';
import { UserRole } from '../users/enums/user-role.enum';

describe('KnowledgeBaseService.suggestForTicket', () => {
    let service: KnowledgeBaseService;
    let articleRepo: any;
    let auditService: any;

    beforeEach(() => {
        auditService = { logAsync: jest.fn(), log: jest.fn() };
        // capture the query builder params passed to andWhere/orderBy/getMany
        const captured: any = { visibilities: null, rank: null, getMany: [] };
        const qb: any = {
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockImplementation((sql: string, params?: any) => {
                if (sql.includes('article.visibility IN')) captured.visibilities = params.visibilities;
                return qb;
            }),
            orderBy: jest.fn().mockImplementation((sql: string) => { captured.rank = sql; return qb; }),
            take: jest.fn().mockReturnThis(),
            getMany: jest.fn(async () => {
                const rows = captured.getMany;
                // attach a fake rank to each row to exercise the threshold filter
                return rows.map((r: any) => ({ ...r, rank: r.rank }));
            }),
        };
        articleRepo = { createQueryBuilder: jest.fn(() => qb), getMany: () => captured.getMany };
        articleRepo.__captured = captured;
        service = new KnowledgeBaseService(articleRepo, {} as any, auditService as any, undefined);
    });

    const text = 'Printer rusak tidak merespon saat print';

    it('returns [] for a query shorter than 3 chars', async () => {
        const result = await service.suggestForTicket('ab', { role: UserRole.USER });
        expect(result).toEqual([]);
    });

    it('filters to PUBLIC-only for an end user', async () => {
        await service.suggestForTicket(text, { role: UserRole.USER });
        expect(articleRepo.__captured.visibilities).toEqual([ArticleVisibility.PUBLIC]);
    });

    it('includes INTERNAL for staff', async () => {
        await service.suggestForTicket(text, { role: UserRole.AGENT });
        expect(articleRepo.__captured.visibilities).toEqual([ArticleVisibility.PUBLIC, ArticleVisibility.INTERNAL]);
    });

    it('only returns articles above the rank threshold', async () => {
        articleRepo.__captured.getMany = [
            { id: 'a1', title: 'Printer reset', rank: 0.12 },  // above 0.05
            { id: 'a2', title: 'Printer jam', rank: 0.02 },    // below
            { id: 'a3', title: 'Koneksi printer', rank: 0.10 }, // above
        ];
        const result = await service.suggestForTicket(text, { role: UserRole.AGENT });
        expect(result.map((a) => String(a.id))).toEqual(['a1', 'a3']);
    });
});
