import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from './upload.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [UploadService],
    exports: [UploadService],
})
export class UploadModule {}
