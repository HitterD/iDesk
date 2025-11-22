import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ArticleView } from './article-view.entity';

@Entity('articles')
export class Article {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column('text')
    content: string;

    @Column()
    category: string;

    @Column('simple-array', { default: [] })
    tags: string[];

    @OneToMany(() => ArticleView, (view) => view.article)
    views: ArticleView[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
