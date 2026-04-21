import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VpnAccess } from './entities/vpn-access.entity';
import { VpnAccessService } from './vpn-access.service';
import { VpnSchedulerService } from './vpn-scheduler.service';
import { VpnAccessController } from './vpn-access.controller';
import { NotificationModule } from '../notifications/notification.module';
import { User } from '../users/entities/user.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([VpnAccess, User]),
        NotificationModule,
        AuditModule,
    ],
    controllers: [VpnAccessController],
    providers: [VpnAccessService, VpnSchedulerService],
    exports: [VpnAccessService],
})
export class VpnAccessModule { }
