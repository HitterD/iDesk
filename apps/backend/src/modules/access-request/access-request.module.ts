import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessRequest } from './entities/access-request.entity';
import { AccessType } from './entities/access-type.entity';
import { AccessRequestService } from './access-request.service';
import { AccessRequestController } from './access-request.controller';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([AccessRequest, AccessType, Ticket, User]),
        AuthModule,
        AuditModule,
    ],
    controllers: [AccessRequestController],
    providers: [AccessRequestService],
    exports: [AccessRequestService],
})
export class AccessRequestModule { }
