import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Article } from './article.entity';

@Entity('article_views')
export class ArticleView {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Article, (article) => article.views, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'articleId' })
    article: Article;

    @Column()
    articleId: string;

    @Column({ default: 1 })
    count: number;

    @CreateDateColumn()
    lastViewedAt: Date;
}
