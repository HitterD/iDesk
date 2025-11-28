import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany } from 'typeorm';
import { ArticleView } from './article-view.entity';

export enum ArticleStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
}

export enum ArticleVisibility {
    PUBLIC = 'public',
    INTERNAL = 'internal',
    PRIVATE = 'private',
}

@Entity('articles')
export class Article {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column('text')
    content: string;

    @Column({ default: 'General' })
    category: string;

    @Column('simple-array', { nullable: true })
    tags: string[];

    @Column({
        type: 'varchar',
        default: ArticleStatus.DRAFT,
    })
    status: ArticleStatus;

    @Column({
        type: 'varchar',
        default: ArticleVisibility.PUBLIC,
    })
    visibility: ArticleVisibility;

    @Column({ default: 0 })
    viewCount: number;

    @Column({ default: 0 })
    helpfulCount: number;

    @Column({ nullable: true })
    authorId: string;

    @Column({ nullable: true })
    authorName: string;

    @Column({ nullable: true })
    featuredImage: string;

    @Column('simple-json', { nullable: true })
    images: string[];

    @OneToMany(() => ArticleView, (view) => view.article)
    views: ArticleView[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt: Date;
}
