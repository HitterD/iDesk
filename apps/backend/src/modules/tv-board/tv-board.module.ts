import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from '../sites/entities/site.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { SlaConfig } from '../ticketing/entities/sla-config.entity';
import { SlaConfigModule } from '../sla-config/sla-config.module';
import { TvBoardService } from './tv-board.service';
import { TvBoardController } from './tv-board.controller';
import { TvBoardGateway } from './tv-board.gateway';
import { TvLeaderboardService } from './tv-leaderboard.service';

@Module({
    imports: [TypeOrmModule.forFeature([Site, Ticket, SlaConfig]), SlaConfigModule],
    controllers: [TvBoardController],
    providers: [TvBoardService, TvBoardGateway, TvLeaderboardService],
    exports: [TvBoardService],
})
export class TvBoardModule { }
