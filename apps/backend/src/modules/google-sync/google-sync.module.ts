import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { SpreadsheetConfig, SpreadsheetSheet, SyncLog } from './entities';
import { GoogleSheetsAdapter } from './adapters';
import { GoogleSyncService } from './google-sync.service';
import { GoogleSyncController } from './google-sync.controller';
import { SyncEngineService, SyncSchedulerService, SyncProcessor } from './services';
import { TicketingModule } from '../ticketing/ticketing.module';
import { RenewalContract } from '../renewal/entities/renewal-contract.entity';
import { VpnAccess } from '../vpn-access/entities/vpn-access.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([SpreadsheetConfig, SpreadsheetSheet, SyncLog, RenewalContract, VpnAccess]),

        BullModule.registerQueue({
            name: 'google-sync',
            defaultJobOptions: {
                removeOnComplete: true,
                removeOnFail: false,
            },
        }),
        TicketingModule, // For EventsGateway
        AuditModule,
    ],
    controllers: [GoogleSyncController],
    providers: [
        GoogleSheetsAdapter,
        GoogleSyncService,
        SyncEngineService,
        SyncSchedulerService,
        SyncProcessor,
    ],
    exports: [GoogleSyncService, GoogleSheetsAdapter, SyncEngineService],
})
export class GoogleSyncModule { }
