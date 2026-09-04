import { ArticleStatus, ArticleVisibility } from './entities/article.entity';
import { KnowledgeBaseService } from './knowledge-base.service';
import { UserRole } from '../users/enums/user-role.enum';

class MockAudit {
    logAsync = jest.fn();
    log = jest.fn();
}

describe('KnowledgeBaseService findOneForUser status gate', () => {
    let service: KnowledgeBaseService;
    let articleRepo: any;

    const makeArticle = (overrides: Partial<any> = {}) => ({
        id: 'a1',
        title: 'Secret draft',
        content: 'Not yet approved.',
        category: 'General',
        tags: [],
        status: ArticleStatus.PENDING_REVIEW,
        visibility: ArticleVisibility.PUBLIC,
        viewCount: 0,
        helpfulCount: 0,
        authorId: 'u-author',
        authorName: 'Author',
        featuredImage: null,
        images: null,
        ...overrides,
    });

    beforeEach(() => {
        articleRepo = {
            findOne: jest.fn(async (args: any) => {
                throw new Error('must override per-test');
            }),
        };
        service = new KnowledgeBaseService(articleRepo, {} as any, new MockAudit() as any, undefined);
    });

    const setArticle = (article: any) => {
        articleRepo.findOne = jest.fn(async () => article);
    };

    const endUser = { userId: 'u-public', role: UserRole.USER };
    const author = { userId: 'u-author', role: UserRole.AGENT };
    const admin = { userId: 'u-admin', role: UserRole.ADMIN };
    const staff = { userId: 'u-staff', role: UserRole.AGENT_OPERATIONAL_SUPPORT };

    it('blocks an end user from a PENDING_REVIEW PUBLIC article by id (the leak)', async () => {
        setArticle(makeArticle());
        await expect(service.findOneForUser('a1', endUser)).rejects.toThrow('not found');
    });

    it('blocks an end user from a DRAFT PUBLIC article by id', async () => {
        setArticle(makeArticle({ status: ArticleStatus.DRAFT }));
        await expect(service.findOneForUser('a1', endUser)).rejects.toThrow('not found');
    });

    it('still lets an end user read a PUBLISHED PUBLIC article', async () => {
        setArticle(makeArticle({ status: ArticleStatus.PUBLISHED }));
        await expect(service.findOneForUser('a1', endUser)).resolves.toMatchObject({
            id: 'a1',
            status: ArticleStatus.PUBLISHED,
        });
    });

    it('lets the author read their own PENDING_REVIEW article', async () => {
        setArticle(makeArticle());
        await expect(service.findOneForUser('a1', author)).resolves.toMatchObject({ id: 'a1' });
    });

    it('lets an admin read a PENDING_REVIEW article (reviewer)', async () => {
        setArticle(makeArticle());
        await expect(service.findOneForUser('a1', admin)).resolves.toMatchObject({ id: 'a1' });
    });

    it('lets internal staff read an unpublished article via the detail path', async () => {
        // Mirrors the list endpoint's `?all=true` behaviour for staff.
        setArticle(makeArticle({ status: ArticleStatus.PENDING_REVIEW, visibility: ArticleVisibility.INTERNAL }));
        await expect(service.findOneForUser('a1', staff)).resolves.toMatchObject({ id: 'a1' });
    });
});
