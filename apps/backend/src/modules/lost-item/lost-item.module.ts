import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LostItemReport } from './entities/lost-item-report.entity';
import { LostItemService } from './lost-item.service';
import { LostItemController } from './lost-item.controller';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([LostItemReport, Ticket, User]),
        AuthModule,
        AuditModule,
    ],
    controllers: [LostItemController],
    providers: [LostItemService],
    exports: [LostItemService],
})
export class LostItemModule { }
