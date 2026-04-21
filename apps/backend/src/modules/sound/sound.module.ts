import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationSound } from './entities/notification-sound.entity';
import { SoundService } from './sound.service';
import { SoundController } from './sound.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([NotificationSound]),
        AuthModule,
    ],
    controllers: [SoundController],
    providers: [SoundService],
    exports: [SoundService],
})
export class SoundModule { }
