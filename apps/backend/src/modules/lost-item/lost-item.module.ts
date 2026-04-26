import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LostItemReport } from './entities/lost-item-report.entity';
import { FoundItemClaim } from './entities/found-item-claim.entity';
import { LostItemStatusLog } from './entities/lost-item-status-log.entity';
import { LostItemService } from './lost-item.service';
import { FoundClaimService } from './found-claim.service';
import { LostItemController } from './lost-item.controller';
import { FoundClaimController } from './found-claim.controller';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([LostItemReport, FoundItemClaim, LostItemStatusLog, Ticket, User]),
        AuthModule,
        AuditModule,
    ],
    controllers: [LostItemController, FoundClaimController],
    providers: [LostItemService, FoundClaimService],
    exports: [LostItemService, FoundClaimService],
})
export class LostItemModule {}
