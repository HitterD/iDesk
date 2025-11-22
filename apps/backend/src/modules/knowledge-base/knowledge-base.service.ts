import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Article } from './entities/article.entity';
import { ArticleView } from './entities/article-view.entity';

@Injectable()
export class KnowledgeBaseService {
    constructor(
        @InjectRepository(Article)
        private articleRepo: Repository<Article>,
        @InjectRepository(ArticleView)
        private viewRepo: Repository<ArticleView>,
    ) { }

    async create(createArticleDto: Partial<Article>): Promise<Article> {
        const article = this.articleRepo.create(createArticleDto);
        return this.articleRepo.save(article);
    }

    async findAll(query?: string): Promise<Article[]> {
        if (query) {
            return this.articleRepo.find({
                where: [
                    { title: ILike(`%${query}%`) },
                    { content: ILike(`%${query}%`) },
                    // Tags are simple-array, ILike might not work perfectly if stored as string, 
                    // but for simple-array in Postgres it's often text. 
                    // Let's assume simple text search for now.
                    { category: ILike(`%${query}%`) }
                ],
                order: { createdAt: 'DESC' },
            });
        }
        return this.articleRepo.find({ order: { createdAt: 'DESC' } });
    }

    async findOne(id: string): Promise<Article> {
        const article = await this.articleRepo.findOne({ where: { id } });
        if (article) {
            // Increment view count
            const view = this.viewRepo.create({ articleId: id });
            await this.viewRepo.save(view);
        }
        return article;
    }

    async search(query: string): Promise<Article[]> {
        return this.findAll(query);
    }
}
