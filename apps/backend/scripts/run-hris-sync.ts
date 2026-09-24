import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HrisSyncService } from '../src/modules/hris-gateway/hris-sync.service';

async function run() {
    console.log('🚀 Memulai konteks aplikasi untuk Sinkronisasi SJATR (10.10.6.51:27080)...');
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
    try {
        const syncService = app.get(HrisSyncService);
        console.log('⏳ Menjalankan HrisSyncService.syncAll() (Insert-Only Murni)...');
        const startTime = Date.now();
        const summary = await syncService.syncAll();
        const durationSec = Math.round((Date.now() - startTime) / 1000);
        console.log('\n========================================');
        console.log(`✅ SINKRONISASI SELESAI dalam ${durationSec} detik:`);
        console.log(`- User Baru Ditambahkan : ${summary.created}`);
        console.log(`- User Lama Dilewati     : ${summary.skipped}`);
        console.log(`- Error                  : ${summary.errors.length}`);
        if (summary.errors.length > 0) {
            console.log('Detail Error:');
            summary.errors.slice(0, 20).forEach(e => console.log('  *', e));
            if (summary.errors.length > 20) {
                console.log(`  * ...dan ${summary.errors.length - 20} error lainnya`);
            }
        }
        console.log('========================================\n');
    } catch (err: any) {
        console.error('❌ Gagal menjalankan sinkronisasi:', err.message);
        throw err;
    } finally {
        await app.close();
    }
}

run().catch(() => process.exit(1));
