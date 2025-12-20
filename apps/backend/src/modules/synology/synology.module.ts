import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupConfiguration } from './entities/backup-configuration.entity';
import { BackupHistory } from './entities/backup-history.entity';
import { SynologyService } from './synology.service';
import { SynologyController } from './synology.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([BackupConfiguration, BackupHistory]),
        AuthModule,
    ],
    controllers: [SynologyController],
    providers: [SynologyService],
    exports: [SynologyService],
})
export class SynologyModule { }
