import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from './entities/site.entity';
import { HandlingSiteService } from './handling-site.service';

/** Kept apart from SitesModule so request modules can resolve the handling site without its Auth/Audit imports. */
@Module({
    imports: [TypeOrmModule.forFeature([Site])],
    providers: [HandlingSiteService],
    exports: [HandlingSiteService],
})
export class SiteHandlingModule { }
