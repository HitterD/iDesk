import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { Article } from './entities/article.entity';
import { ArticleView } from './entities/article-view.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Article, ArticleView])],
    controllers: [KnowledgeBaseController],
    providers: [KnowledgeBaseService],
    exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule { }
