import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IpWhitelist } from './entities/ip-whitelist.entity';
import { IpWhitelistService } from './ip-whitelist.service';
import { IpWhitelistController } from './ip-whitelist.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [TypeOrmModule.forFeature([IpWhitelist]), AuditModule],
    controllers: [IpWhitelistController],
    providers: [IpWhitelistService],
    exports: [IpWhitelistService],
})
export class IpWhitelistModule { }
