import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from './entities/site.entity';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Site]),
        AuthModule,
        AuditModule,
    ],
    controllers: [SitesController],
    providers: [SitesService],
    exports: [SitesService],
})
export class SitesModule { }
