import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { Article } from './entities/article.entity';
import { ArticleView } from './entities/article-view.entity';
import { User } from '../users/entities/user.entity';
import { TicketingModule } from '../ticketing/ticketing.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Article, ArticleView, User]),
        forwardRef(() => TicketingModule),
    ],
    controllers: [KnowledgeBaseController],
    providers: [KnowledgeBaseService],
    exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule { }
