import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SavedSearch } from './entities/saved-search.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Article } from '../knowledge-base/entities/article.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            SavedSearch,
            Ticket,
            User,
            Article,
        ]),
    ],
    controllers: [SearchController],
    providers: [SearchService],
    exports: [SearchService],
})
export class SearchModule {}
