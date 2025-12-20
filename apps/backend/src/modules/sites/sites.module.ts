import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from './entities/site.entity';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Site]),
        AuthModule,
    ],
    controllers: [SitesController],
    providers: [SitesService],
    exports: [SitesService],
})
export class SitesModule { }
