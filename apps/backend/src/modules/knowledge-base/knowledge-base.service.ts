import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { Article, ArticleStatus, ArticleVisibility } from './entities/article.entity';
import { ArticleView } from './entities/article-view.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

export interface ArticleFilters {
    query?: string;
    status?: ArticleStatus;
    category?: string;
    visibility?: ArticleVisibility;
    authorId?: string;
}

@Injectable()
export class KnowledgeBaseService {
    constructor(
        @InjectRepository(Article)
        private articleRepo: Repository<Article>,
        @InjectRepository(ArticleView)
        private viewRepo: Repository<ArticleView>,
    ) { }

    async create(createArticleDto: CreateArticleDto, authorId?: string, authorName?: string): Promise<Article> {
        const article = this.articleRepo.create({
            ...createArticleDto,
            authorId,
            authorName,
        });
        return this.articleRepo.save(article);
    }

    async findAll(filters?: ArticleFilters): Promise<Article[]> {
        const queryBuilder = this.articleRepo.createQueryBuilder('article');

        if (filters?.query) {
            queryBuilder.andWhere(
                '(article.title ILIKE :q OR article.content ILIKE :q OR article.category ILIKE :q)',
                { q: `%${filters.query}%` }
            );
        }

        if (filters?.status) {
            queryBuilder.andWhere('article.status = :status', { status: filters.status });
        }

        if (filters?.category) {
            queryBuilder.andWhere('article.category = :category', { category: filters.category });
        }

        if (filters?.visibility) {
            queryBuilder.andWhere('article.visibility = :visibility', { visibility: filters.visibility });
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
            visibility: ArticleVisibility.PUBLIC,
        });
    }

    async findOne(id: string, incrementView = true): Promise<Article> {
        const article = await this.articleRepo.findOne({ where: { id } });
        if (!article) {
            throw new NotFoundException(`Article with ID ${id} not found`);
        }

        if (incrementView) {
            // Increment view count
            await this.articleRepo.increment({ id }, 'viewCount', 1);
            const view = this.viewRepo.create({ articleId: id });
            await this.viewRepo.save(view);
        }

        return article;
    }

    async update(id: string, updateArticleDto: UpdateArticleDto): Promise<Article> {
        const article = await this.findOne(id, false);
        Object.assign(article, updateArticleDto);
        return this.articleRepo.save(article);
    }

    async updateStatus(id: string, status: ArticleStatus): Promise<Article> {
        const article = await this.findOne(id, false);
        article.status = status;
        return this.articleRepo.save(article);
    }

    async remove(id: string): Promise<void> {
        const article = await this.findOne(id, false);
        await this.articleRepo.softRemove(article);
    }

    async hardRemove(id: string): Promise<void> {
        await this.articleRepo.delete(id);
    }

    async restore(id: string): Promise<Article> {
        await this.articleRepo.restore(id);
        return this.articleRepo.findOne({ where: { id }, withDeleted: true });
    }

    async incrementViewCount(id: string): Promise<{ success: boolean }> {
        const article = await this.articleRepo.findOne({ where: { id } });
        if (!article) {
            throw new NotFoundException(`Article with ID ${id} not found`);
        }
        await this.articleRepo.increment({ id }, 'viewCount', 1);
        const view = this.viewRepo.create({ articleId: id });
        await this.viewRepo.save(view);
        return { success: true };
    }

    async markHelpful(id: string): Promise<Article> {
        await this.articleRepo.increment({ id }, 'helpfulCount', 1);
        return this.findOne(id, false);
    }

    async getPopular(limit = 10): Promise<Article[]> {
        return this.articleRepo.find({
            where: { status: ArticleStatus.PUBLISHED },
            order: { viewCount: 'DESC' },
            take: limit,
        });
    }

    async getRecent(limit = 10): Promise<Article[]> {
        return this.articleRepo.find({
            where: { status: ArticleStatus.PUBLISHED },
            order: { updatedAt: 'DESC' },
            take: limit,
        });
    }

    async getCategories(): Promise<string[]> {
        const result = await this.articleRepo
            .createQueryBuilder('article')
            .select('DISTINCT article.category', 'category')
            .where('article.status = :status', { status: ArticleStatus.PUBLISHED })
            .getRawMany();
        return result.map(r => r.category);
    }

    async getStats(): Promise<{ totalArticles: number; totalViews: number; totalHelpful: number; byStatus: Record<string, number> }> {
        const totalArticles = await this.articleRepo.count();
        const viewsResult = await this.articleRepo
            .createQueryBuilder('article')
            .select('SUM(article.viewCount)', 'total')
            .getRawOne();
        const helpfulResult = await this.articleRepo
            .createQueryBuilder('article')
            .select('SUM(article.helpfulCount)', 'total')
            .getRawOne();

        const byStatus = {
            draft: await this.articleRepo.count({ where: { status: ArticleStatus.DRAFT } }),
            published: await this.articleRepo.count({ where: { status: ArticleStatus.PUBLISHED } }),
            archived: await this.articleRepo.count({ where: { status: ArticleStatus.ARCHIVED } }),
        };

        return {
            totalArticles,
            totalViews: parseInt(viewsResult?.total || '0'),
            totalHelpful: parseInt(helpfulResult?.total || '0'),
            byStatus,
        };
    }

    async search(query: string): Promise<Article[]> {
        return this.findPublished(query);
    }
}
