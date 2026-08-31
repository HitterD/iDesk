import { ArticleStatus, ArticleVisibility } from './entities/article.entity';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UserRole } from '../users/enums/user-role.enum';
import { UpdateArticleDto } from './dto/update-article.dto';

class MockAudit {
    logAsync = jest.fn();
    log = jest.fn();
}

describe('KnowledgeBaseService review flow', () => {
    let service: KnowledgeBaseService;
    let articleRepo: any;
    let auditService: MockAudit;

    const makeMainArticle = () => ({
        id: 'a1',
        title: 'How to reset printer',
        content: 'Push the big button twice.',
        category: 'Hardware',
        tags: [],
        status: ArticleStatus.PENDING_REVIEW,
        visibility: ArticleVisibility.PUBLIC,
        viewCount: 0,
        helpfulCount: 0,
        authorId: 'u-agent',
        authorName: 'Agent One',
        featuredImage: null,
        images: null,
    });

    let articleUnderTest: any;

    beforeEach(() => {
        articleUnderTest = makeMainArticle();
        articleRepo = {
            create: jest.fn((data: any) => data),
            save: jest.fn(async (data: any) => ({ ...articleUnderTest, ...data })),
            findOne: jest.fn(async () => articleUnderTest),
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
                getRawOne: jest.fn().mockResolvedValue({
                    totalArticles: '0', totalViews: '0', totalHelpful: '0',
                    draftCount: '0', publishedCount: '0', archivedCount: '0',
                }),
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
            })),
        };
        auditService = new MockAudit();
        service = new KnowledgeBaseService(
            articleRepo,
            {} as any,
            auditService as any,
            undefined,
        );
    });

    describe('create', () => {
        it('turns an agent PUBLIC publish into PENDING_REVIEW', async () => {
            const dto: CreateArticleDto = {
                title: 'Printer reset',
                content: 'Push the big button twice',
                category: 'Hardware',
                status: ArticleStatus.PUBLISHED,
                visibility: ArticleVisibility.PUBLIC,
            };
            const saved = await service.create(dto, 'u-agent', 'Agent One', UserRole.AGENT);
            expect(saved.status).toBe(ArticleStatus.PENDING_REVIEW);
            expect(saved.visibility).toBe(ArticleVisibility.PUBLIC);
        });

        it('lets an agent publish INTERNAL directly', async () => {
            const dto: CreateArticleDto = {
                title: 'Internal how-to',
                content: 'Steps for the ICT team only',
                status: ArticleStatus.PUBLISHED,
                visibility: ArticleVisibility.INTERNAL,
            };
            const saved = await service.create(dto, 'u-agent', 'Agent One', UserRole.AGENT);
            expect(saved.status).toBe(ArticleStatus.PUBLISHED);
        });

        it('lets an admin publish PUBLIC directly', async () => {
            const dto: CreateArticleDto = {
                title: 'Admin article',
                content: 'Approved by admin right away',
                status: ArticleStatus.PUBLISHED,
                visibility: ArticleVisibility.PUBLIC,
            };
            const saved = await service.create(dto, 'u-admin', 'Admin', UserRole.ADMIN);
            expect(saved.status).toBe(ArticleStatus.PUBLISHED);
        });
    });

    describe('updateStatus', () => {
        beforeEach(() => {
            // fresh PENDING_REVIEW article under test
            articleUnderTest = makeMainArticle();
            articleRepo.findOne = jest.fn(async () => articleUnderTest);
        });

        it('lets an admin approve PENDING_REVIEW to PUBLISHED', async () => {
            const updated = await service.updateStatus('a1', ArticleStatus.PUBLISHED, 'u-admin', UserRole.ADMIN);
            expect(updated.status).toBe(ArticleStatus.PUBLISHED);
        });

        it('lets an admin reject PENDING_REVIEW to DRAFT', async () => {
            const updated = await service.updateStatus('a1', ArticleStatus.DRAFT, 'u-admin', UserRole.ADMIN);
            expect(updated.status).toBe(ArticleStatus.DRAFT);
        });

        it('blocks a non-admin from approving PENDING_REVIEW to PUBLISHED', async () => {
            await expect(
                service.updateStatus('a1', ArticleStatus.PUBLISHED, 'u-agent', UserRole.AGENT),
            ).rejects.toThrow('Only an admin may approve a pending_review article');
        });
    });

    describe('update', () => {
        it('keeps a non-admin from publishing a PENDING_REVIEW article through an edit', async () => {
            const dto: UpdateArticleDto = { status: ArticleStatus.PUBLISHED };
            const updated = await service.update('a1', dto, 'u-agent', UserRole.AGENT);
            expect(updated.status).toBe(ArticleStatus.PENDING_REVIEW);
        });

        it('lets an admin apply a status change in an edit', async () => {
            const dto: UpdateArticleDto = { status: ArticleStatus.PUBLISHED };
            const updated = await service.update('a1', dto, 'u-admin', UserRole.ADMIN);
            expect(updated.status).toBe(ArticleStatus.PUBLISHED);
        });
    });
});
