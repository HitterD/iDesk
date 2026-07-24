import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from '../sites/entities/site.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { TvBoardService } from './tv-board.service';

@Module({
    imports: [TypeOrmModule.forFeature([Site, Ticket])],
    providers: [TvBoardService],
    exports: [TvBoardService],
})
export class TvBoardModule { }
