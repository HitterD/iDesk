import { Injectable, NotFoundException, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere, In } from 'typeorm';
import { Article, ArticleStatus, ArticleVisibility } from './entities/article.entity';
import { ArticleView } from './entities/article-view.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { EventsGateway } from '../ticketing/presentation/gateways/events.gateway';
import { UserRole } from '../users/enums/user-role.enum';
import { canReadArticle } from './kb-visibility.util';

export interface ArticleFilters {
    query?: string;
    status?: ArticleStatus;
    category?: string;
    /** Visibility levels the caller may read. Derived from the caller's role, never from user input. */
    visibilities?: ArticleVisibility[];
    authorId?: string;
}

@Injectable()
export class KnowledgeBaseService {
    // 24-Hour In-Memory Deduplication Cache for Unique Views
    private readonly viewCache = new Map<string, number>();
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 Hours

    constructor(
        @InjectRepository(Article)
        private articleRepo: Repository<Article>,
        @InjectRepository(ArticleView)
        private viewRepo: Repository<ArticleView>,
        private readonly auditService: AuditService,
        @Inject(forwardRef(() => EventsGateway))
        @Optional()
        private readonly eventsGateway?: EventsGateway,
    ) { }

    async create(createArticleDto: CreateArticleDto, authorId?: string, authorName?: string): Promise<Article> {
        const article = this.articleRepo.create({
            ...createArticleDto,
            authorId,
            authorName,
        });
        const saved = await this.articleRepo.save(article);

        // Audit log for article creation
        this.auditService.logAsync({
            userId: authorId || 'system',
            action: AuditAction.ARTICLE_CREATE,
            entityType: 'article',
            entityId: saved.id,
            newValue: { title: saved.title, category: saved.category, status: saved.status },
            description: `Article "${saved.title}" created`,
        });

        return saved;
    }

    async findAll(filters?: ArticleFilters): Promise<Article[]> {
        const queryBuilder = this.articleRepo.createQueryBuilder('article');

        // OPTIMIZED: Use PostgreSQL Full-Text Search for longer queries
        // Falls back to ILIKE for short queries (≤3 chars) for better UX
        if (filters?.query) {
            const searchTerm = filters.query.trim();

            if (searchTerm.length <= 3) {
                // Short query - use ILIKE for flexibility
                queryBuilder.andWhere(
                    '(article.title ILIKE :q OR article.content ILIKE :q OR article.category ILIKE :q)',
                    { q: `%${searchTerm}%` }
                );
            } else {
                // Longer query - use Full-Text Search for performance
                queryBuilder.andWhere(
                    `(to_tsvector('indonesian', COALESCE(article.title, '') || ' ' || COALESCE(article.content, '')) @@ plainto_tsquery('indonesian', :q) OR article.category ILIKE :catQ)`,
                    { q: searchTerm, catQ: `%${searchTerm}%` }
                );
            }
        }

        if (filters?.status) {
            queryBuilder.andWhere('article.status = :status', { status: filters.status });
        }

        if (filters?.category) {
            queryBuilder.andWhere('article.category = :category', { category: filters.category });
        }

        if (filters?.visibilities?.length) {
            queryBuilder.andWhere('article.visibility IN (:...visibilities)', { visibilities: filters.visibilities });
        }

        if (filters?.authorId) {
            queryBuilder.andWhere('article.authorId = :authorId', { authorId: filters.authorId });
        }

        queryBuilder.orderBy('article.createdAt', 'DESC');

        return queryBuilder.getMany();
    }

    async findPublished(query?: string): Promise<Article[]> {
        return this.findAll({
            query,
            status: ArticleStatus.PUBLISHED,
            visibilities: [ArticleVisibility.PUBLIC],
        });
    }

    async findOne(id: string, incrementView = false): Promise<Article> {
        const article = await this.articleRepo.findOne({ where: { id } });
        if (!article) {
            throw new NotFoundException(`Article with ID ${id} not found`);
        }

        if (incrementView) {
            await this.incrementViewCount(id);
        }

        return article;
    }

    /**
     * Read a single article, enforcing visibility for the calling user.
     * Responds with NotFound (not Forbidden) so the existence of a restricted
     * article is not disclosed to callers who may not read it.
     */
    async findOneForUser(
        id: string,
        user: { userId?: string; role?: UserRole | string | null },
    ): Promise<Article> {
        const article = await this.findOne(id, false);

        if (!canReadArticle(article, user)) {
            throw new NotFoundException(`Article with ID ${id} not found`);
        }

        return article;
    }

    async update(id: string, updateArticleDto: UpdateArticleDto, updatedByUserId?: string): Promise<Article> {
        const article = await this.findOne(id, false);
        const oldValue = { title: article.title, category: article.category, status: article.status };
        Object.assign(article, updateArticleDto);
        const saved = await this.articleRepo.save(article);

        // Audit log for article update
        this.auditService.logAsync({
            userId: updatedByUserId || 'system',
            action: AuditAction.ARTICLE_UPDATE,
            entityType: 'article',
            entityId: id,
            oldValue,
            newValue: { title: saved.title, category: saved.category, status: saved.status },
            description: `Article "${saved.title}" updated`,
        });

        return saved;
    }

    async updateStatus(id: string, status: ArticleStatus, updatedByUserId?: string): Promise<Article> {
        const article = await this.findOne(id, false);
        const oldStatus = article.status;
        article.status = status;
        const saved = await this.articleRepo.save(article);

        // Audit log for status change / publish
        const isPublish = status === ArticleStatus.PUBLISHED && oldStatus !== ArticleStatus.PUBLISHED;
        this.auditService.logAsync({
            userId: updatedByUserId || 'system',
            action: isPublish ? AuditAction.ARTICLE_PUBLISH : AuditAction.ARTICLE_UPDATE,
            entityType: 'article',
            entityId: id,
            oldValue: { status: oldStatus },
            newValue: { status },
            description: isPublish ? `Article "${article.title}" published` : `Article "${article.title}" status changed to ${status}`,
        });

        return saved;
    }

    async remove(id: string, deletedByUserId?: string): Promise<void> {
        const article = await this.findOne(id, false);

        // Audit log for article soft delete
        this.auditService.logAsync({
            userId: deletedByUserId || 'system',
            action: AuditAction.ARTICLE_DELETE,
            entityType: 'article',
            entityId: id,
            oldValue: { title: article.title, category: article.category },
            description: `Article "${article.title}" deleted (soft)`,
        });

        await this.articleRepo.softRemove(article);
    }

    async hardRemove(id: string, deletedByUserId?: string): Promise<void> {
        // Audit log for article hard delete
        this.auditService.logAsync({
            userId: deletedByUserId || 'system',
            action: AuditAction.ARTICLE_DELETE,
            entityType: 'article',
            entityId: id,
            description: `Article ${id} permanently deleted`,
        });

        await this.articleRepo.delete(id);
    }

    async restore(id: string): Promise<Article> {
        await this.articleRepo.restore(id);
        const article = await this.articleRepo.findOne({ where: { id }, withDeleted: true });
        if (!article) throw new NotFoundException(`Article with ID ${id} not found`);
        return article;
    }

    async incrementViewCount(
        id: string,
        viewerInfo?: {
            userId?: string;
            fullName?: string;
            avatarUrl?: string;
            role?: string;
            ip?: string;
        },
    ): Promise<{ success: boolean; viewCount: number; alreadyViewed: boolean }> {
        const article = await this.articleRepo.findOne({ where: { id } });
        if (!article) {
            throw new NotFoundException(`Article with ID ${id} not found`);
        }

        const viewerKey = viewerInfo?.userId || viewerInfo?.ip || 'anonymous';
        const normalizedKey = `${id}:${viewerKey}`;
        const lastViewedTimestamp = this.viewCache.get(normalizedKey);
        const now = Date.now();

        // If viewed within last 24 hours, do not increment
        if (lastViewedTimestamp && (now - lastViewedTimestamp) < this.CACHE_TTL) {
            return { success: true, viewCount: article.viewCount, alreadyViewed: true };
        }

        // Record unique view
        this.viewCache.set(normalizedKey, now);

        // Prune cache if it grows too large (> 10,000 entries)
        if (this.viewCache.size > 10000) {
            for (const [k, timestamp] of this.viewCache.entries()) {
                if (now - timestamp > this.CACHE_TTL) {
                    this.viewCache.delete(k);
                }
            }
        }

        await this.articleRepo.increment({ id }, 'viewCount', 1);
        const newCount = article.viewCount + 1;

        // Upsert or create ArticleView record
        let view: ArticleView;
        if (viewerInfo?.userId) {
            const existingView = await this.viewRepo.findOne({
                where: { articleId: id, userId: viewerInfo.userId },
            });
            if (existingView) {
                existingView.count = (existingView.count || 1) + 1;
                existingView.userName = viewerInfo.fullName || existingView.userName;
                existingView.userAvatar = viewerInfo.avatarUrl || existingView.userAvatar;
                existingView.userRole = viewerInfo.role || existingView.userRole;
                existingView.lastViewedAt = new Date();
                view = await this.viewRepo.save(existingView);
            } else {
                view = this.viewRepo.create({
                    articleId: id,
                    userId: viewerInfo.userId,
                    userName: viewerInfo.fullName,
                    userAvatar: viewerInfo.avatarUrl,
                    userRole: viewerInfo.role,
                    count: 1,
                });
                view = await this.viewRepo.save(view);
            }
        } else {
            view = this.viewRepo.create({
                articleId: id,
                userName: 'Pengunjung',
                count: 1,
            });
            view = await this.viewRepo.save(view);
        }

        // Realtime broadcast via WebSocket
        try {
            this.eventsGateway?.notifyKBArticleView(id, newCount, {
                id: view.id,
                userId: view.userId,
                fullName: view.userName || 'Pengguna',
                avatarUrl: view.userAvatar,
                role: view.userRole,
                lastViewedAt: view.lastViewedAt || new Date(),
            });
        } catch {
            // non-blocking
        }

        return { success: true, viewCount: newCount, alreadyViewed: false };
    }

    async getViewers(articleId: string, limit = 50): Promise<{
        totalViewers: number;
        recentViewers: Array<{
            id: string;
            userId?: string;
            fullName: string;
            avatarUrl?: string;
            jobTitle?: string;
            role?: string;
            lastViewedAt: Date;
        }>;
    }> {
        const [views, total] = await this.viewRepo.findAndCount({
            where: { articleId },
            relations: ['user'],
            order: { lastViewedAt: 'DESC' },
            take: limit,
        });

        const formatted = views.map((v) => ({
            id: v.id,
            userId: v.userId,
            fullName: v.user?.fullName || v.userName || 'Pengguna',
            avatarUrl: v.user?.avatarUrl || v.userAvatar,
            jobTitle: v.user?.jobTitle || (v.userRole === 'admin' ? 'System Administrator' : v.userRole === 'agent' ? 'IT Support Staff' : 'Karyawan'),
            role: v.user?.role || v.userRole || 'user',
            lastViewedAt: v.lastViewedAt || v.createdAt,
        }));

        return {
            totalViewers: total,
            recentViewers: formatted,
        };
    }

    async markHelpful(id: string): Promise<Article> {
        await this.articleRepo.increment({ id }, 'helpfulCount', 1);
        const updated = await this.findOne(id, false);

        // Realtime broadcast via WebSocket
        try {
            this.eventsGateway?.notifyKBArticleHelpful(id, updated.helpfulCount);
        } catch {
            // non-blocking
        }

        return updated;
    }

    async getPopular(limit = 10, visibilities: ArticleVisibility[] = [ArticleVisibility.PUBLIC]): Promise<Article[]> {
        return this.articleRepo.find({
            where: { status: ArticleStatus.PUBLISHED, visibility: In(visibilities) },
            order: { viewCount: 'DESC' },
            take: limit,
        });
    }

    async getRecent(limit = 10, visibilities: ArticleVisibility[] = [ArticleVisibility.PUBLIC]): Promise<Article[]> {
        return this.articleRepo.find({
            where: { status: ArticleStatus.PUBLISHED, visibility: In(visibilities) },
            order: { updatedAt: 'DESC' },
            take: limit,
        });
    }

    async getCategories(visibilities: ArticleVisibility[] = [ArticleVisibility.PUBLIC]): Promise<string[]> {
        const result = await this.articleRepo
            .createQueryBuilder('article')
            .select('DISTINCT article.category', 'category')
            .where('article.status = :status', { status: ArticleStatus.PUBLISHED })
            .andWhere('article.visibility IN (:...visibilities)', { visibilities })
            .getRawMany();
        return result.map(r => r.category);
    }

    /**
     * Get KB statistics
     * OPTIMIZED: Uses single GROUP BY query instead of 4 separate COUNT queries
     */
    async getStats(visibilities: ArticleVisibility[] = [ArticleVisibility.PUBLIC]): Promise<{ totalArticles: number; totalViews: number; totalHelpful: number; byStatus: Record<string, number> }> {
        // Single query for all stats using SQL aggregations.
        // Counts only articles the caller is allowed to read, so an end user
        // never sees draft/internal/private article counts.
        const statsResult = await this.articleRepo
            .createQueryBuilder('article')
            .select('COUNT(*)', 'totalArticles')
            .addSelect('COALESCE(SUM(article."viewCount"), 0)', 'totalViews')
            .addSelect('COALESCE(SUM(article."helpfulCount"), 0)', 'totalHelpful')
            .addSelect(`COUNT(*) FILTER (WHERE article.status = '${ArticleStatus.DRAFT}')`, 'draftCount')
            .addSelect(`COUNT(*) FILTER (WHERE article.status = '${ArticleStatus.PUBLISHED}')`, 'publishedCount')
            .addSelect(`COUNT(*) FILTER (WHERE article.status = '${ArticleStatus.ARCHIVED}')`, 'archivedCount')
            .where('article.visibility IN (:...visibilities)', { visibilities })
            .getRawOne();

        return {
            totalArticles: parseInt(statsResult?.totalArticles || '0'),
            totalViews: parseInt(statsResult?.totalViews || '0'),
            totalHelpful: parseInt(statsResult?.totalHelpful || '0'),
            byStatus: {
                draft: parseInt(statsResult?.draftCount || '0'),
                published: parseInt(statsResult?.publishedCount || '0'),
                archived: parseInt(statsResult?.archivedCount || '0'),
            },
        };
    }

    async search(query: string): Promise<Article[]> {
        return this.findPublished(query);
    }
}
