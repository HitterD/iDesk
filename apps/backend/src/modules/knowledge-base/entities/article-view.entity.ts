import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Article } from './article.entity';
import { User } from '../../users/entities/user.entity';

@Entity('article_views')
@Index(['articleId', 'userId'])
export class ArticleView {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Article, (article) => article.views, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'articleId' })
    article: Article;

    @Column()
    articleId: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'userId' })
    user?: User;

    @Column({ type: 'uuid', nullable: true })
    userId?: string;

    @Column({ type: 'varchar', nullable: true })
    userName?: string;

    @Column({ type: 'varchar', nullable: true })
    userAvatar?: string;

    @Column({ type: 'varchar', nullable: true })
    userRole?: string;

    @Column({ default: 1 })
    count: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    lastViewedAt: Date;
}
