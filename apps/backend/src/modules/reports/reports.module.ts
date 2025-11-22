import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Ticket, User])],
    controllers: [ReportsController],
    providers: [ReportsService],
})
export class ReportsModule { }
