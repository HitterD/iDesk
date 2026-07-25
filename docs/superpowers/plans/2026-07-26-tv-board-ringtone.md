# TV Board Custom Ringtone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halaman TV Board (`/tv/:token`) membunyikan ringtone kustom per site saat tiket masuk, saat tiket pindah ke In Progress, dan pada jam pulang yang dapat diatur.

**Architecture:** Empat kolom nullable ditambahkan ke entity `Site` (tiga URL audio + satu jam pulang `HH:mm`). Admin mengunggah file lewat route baru di `SitesController` yang meniru konfigurasi multer modul `sound` yang sudah ada. `TvBoardService` menyertakan keempat nilai itu ke payload papan tanpa query tambahan, karena baris `Site` sudah dimuat. Sisi TV membandingkan snapshot ID tiket antar-update lewat fungsi murni untuk memutuskan bunyi mana yang diputar.

**Tech Stack:** NestJS + TypeORM + Jest (backend), React + Vite + Tailwind + Vitest + Testing Library (frontend), multer via `@nestjs/platform-express`, socket.io.

## Global Constraints

- Spec sumber: `docs/superpowers/specs/2026-07-26-tv-board-ringtone-design.md`
- Branch kerja: `feature/tv-board-kanban` (branch saat ini). Jangan pindah branch.
- Semua kolom ringtone nullable. `null` berarti event tersebut **diam** — bukan error, tidak dicatat di log.
- Format `closingTime` wajib `HH:mm` 24 jam, divalidasi regex `/^([01]\d|2[0-3]):[0-5]\d$/`.
- Slot ringtone hanya tiga nilai sah: `newTicket`, `inProgress`, `closing`. Nilai lain melempar `BadRequestException`.
- Batas upload audio: mimetype harus diawali `audio/`, ukuran maksimum `5 * 1024 * 1024` byte, tujuan `./uploads/sounds`, nama file acak 32 karakter hex + ekstensi asli.
- Ringtone lama **tidak** dihapus dari disk saat diganti. Beri komentar `ponytail:` di tempat keputusan ini terlihat.
- Bunyi maksimal satu kali per jenis per update papan, berapa pun jumlah tiket yang memicu.
- Snapshot papan `null` (muat pertama atau setelah socket putus) tidak pernah membunyikan apa pun.
- Output pesan UI berbahasa Indonesia, mengikuti gaya file yang ada.
- Indentasi 4 spasi, mengikuti codebase.

### Catatan menjalankan test di mesin ini

Output konsol Jest/Vitest sering teracak oleh layer tooling di lingkungan ini. Bila ringkasan test tidak terbaca, jalankan ulang dengan output JSON lalu baca hasilnya:

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx jest <pola> --json --outputFile="$env:TEMP\jest.json"
node -e "const r=require(process.env.TEMP+'/jest.json');console.log('total',r.numTotalTests,'passed',r.numPassedTests,'failed',r.numFailedTests);r.testResults.forEach(s=>s.assertionResults.filter(a=>a.status==='failed').forEach(a=>console.log('FAIL:',a.fullName)))"
```

Pola yang sama berlaku untuk frontend dengan `npx vitest run <pola> --reporter=json --outputFile="$env:TEMP\vitest.json"`.

---

## File Structure

**Backend — jalur tulis (admin mengatur ringtone)**

| File | Tanggung jawab |
|---|---|
| `apps/backend/src/modules/sites/entities/site.entity.ts` | Empat kolom baru pada `Site` |
| `apps/backend/src/migrations/1784800000000-AddTvRingtonesToSite.ts` | Migrasi keempat kolom |
| `apps/backend/src/modules/sites/dto/create-site.dto.ts` | Field `closingTime` + validasi regex (diwarisi `UpdateSiteDto` lewat `PartialType`) |
| `apps/backend/src/modules/sites/sites.service.ts` | `setTvRingtone`, `clearTvRingtone`, peta slot→kolom |
| `apps/backend/src/modules/sites/sites.controller.ts` | Route upload dan hapus ringtone |
| `apps/backend/src/modules/sites/sites.service.spec.ts` | Test unit service |

**Backend — jalur baca (TV mengambil ringtone)**

| File | Tanggung jawab |
|---|---|
| `apps/backend/src/modules/tv-board/tv-board.service.ts` | Tipe `TvBoardRingtones` + field `ringtones` pada payload |
| `apps/backend/src/modules/tv-board/tv-board.service.spec.ts` | Test payload ringtone |
| `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts` | Fixture mock disesuaikan |

**Frontend — logika murni (paling banyak dites)**

| File | Tanggung jawab |
|---|---|
| `apps/frontend/src/features/public/hooks/detectBoardSounds.ts` | Membandingkan dua snapshot papan → daftar event bunyi |
| `apps/frontend/src/features/public/hooks/shouldPlayClosing.ts` | Memutuskan apakah ringtone jam pulang harus bunyi |
| `apps/frontend/src/features/public/hooks/__tests__/detectBoardSounds.test.ts` | Test tabel input/output |
| `apps/frontend/src/features/public/hooks/__tests__/shouldPlayClosing.test.ts` | Test tabel input/output |

**Frontend — efek samping**

| File | Tanggung jawab |
|---|---|
| `apps/frontend/src/features/public/hooks/useRingtone.ts` | Satu instance `Audio`, flag `blocked`, buka kunci saat ada interaksi |
| `apps/frontend/src/features/public/hooks/__tests__/useRingtone.test.ts` | Test hook |
| `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts` | Cerminan tipe `ringtones` |
| `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx` | Merangkai deteksi, pemutar, jam pulang, indikator |
| `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx` | Test indikator |
| `apps/frontend/src/features/settings/components/TvBoardSettings.tsx` | UI unggah tiga slot + input jam pulang |

Fungsi murni dipisah dari hook agar dapat dites tanpa DOM maupun timer. `detectBoardSounds` dan `shouldPlayClosing` masing-masing satu file karena keduanya berubah karena alasan berbeda.

---

## Task 1: Kolom ringtone pada entity Site + migrasi

**Files:**
- Modify: `apps/backend/src/modules/sites/entities/site.entity.ts:38-39`
- Create: `apps/backend/src/migrations/1784800000000-AddTvRingtonesToSite.ts`

**Interfaces:**
- Consumes: tidak ada (task pertama)
- Produces: kolom `Site.ringtoneNewTicket`, `Site.ringtoneInProgress`, `Site.ringtoneClosing` (semua `string | null`), dan `Site.closingTime` (`string | null`, format `HH:mm`)

- [ ] **Step 1: Tambah empat kolom ke entity**

Buka `apps/backend/src/modules/sites/entities/site.entity.ts`. Setelah blok `tvToken` (baris 38-39) dan sebelum `@CreateDateColumn()`, sisipkan:

```ts
    @Column({ type: 'varchar', nullable: true })
    ringtoneNewTicket: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneInProgress: string | null;

    @Column({ type: 'varchar', nullable: true })
    ringtoneClosing: string | null;

    @Column({ type: 'varchar', length: 5, nullable: true })
    closingTime: string | null;
```

- [ ] **Step 2: Buat migrasi**

Buat `apps/backend/src/migrations/1784800000000-AddTvRingtonesToSite.ts` dengan isi berikut. Pola `IF NOT EXISTS` mengikuti migrasi `1784700000000-AddTvTokenToSite.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTvRingtonesToSite1784800000000 implements MigrationInterface {
    public async up(qr: QueryRunner): Promise<void> {
        await qr.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "ringtoneNewTicket" varchar`);
        await qr.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "ringtoneInProgress" varchar`);
        await qr.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "ringtoneClosing" varchar`);
        await qr.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "closingTime" varchar(5)`);
    }

    public async down(qr: QueryRunner): Promise<void> {
        await qr.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "closingTime"`);
        await qr.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "ringtoneClosing"`);
        await qr.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "ringtoneInProgress"`);
        await qr.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "ringtoneNewTicket"`);
    }
}
```

- [ ] **Step 3: Verifikasi kompilasi**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx tsc -b --noEmit
```

Harapan: keluar dengan exit code 0, tanpa pesan error.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/sites/entities/site.entity.ts apps/backend/src/migrations/1784800000000-AddTvRingtonesToSite.ts
git commit -m "feat(tv-board): add per-site ringtone columns to Site"
```

---

## Task 2: Service menyimpan dan menghapus ringtone

**Files:**
- Modify: `apps/backend/src/modules/sites/sites.service.ts` (tambah setelah `revokeTvToken`, baris 166)
- Modify: `apps/backend/src/modules/sites/dto/create-site.dto.ts:1` dan akhir kelas
- Test: `apps/backend/src/modules/sites/sites.service.spec.ts`

**Interfaces:**
- Consumes: kolom `Site.ringtoneNewTicket`, `Site.ringtoneInProgress`, `Site.ringtoneClosing`, `Site.closingTime` dari Task 1
- Produces:
  - `export type TvRingtoneSlot = 'newTicket' | 'inProgress' | 'closing'`
  - `SitesService.setTvRingtone(id: string, slot: string, url: string, userId?: string): Promise<Site>`
  - `SitesService.clearTvRingtone(id: string, slot: string, userId?: string): Promise<Site>`
  - Field DTO `closingTime?: string` pada `CreateSiteDto`, otomatis diwarisi `UpdateSiteDto`

- [ ] **Step 1: Tulis test yang gagal untuk service**

Buka `apps/backend/src/modules/sites/sites.service.spec.ts`. Ubah baris 3 agar mengimpor `BadRequestException`:

```ts
import { NotFoundException, BadRequestException } from '@nestjs/common';
```

Lalu tambahkan blok berikut tepat sebelum kurung tutup terakhir file (`});` paling bawah, penutup `describe('SitesService — TV token', ...)`), sehingga berbagi `beforeEach` yang sudah ada:

```ts
    describe('TV ringtone', () => {
        it.each([
            ['newTicket', 'ringtoneNewTicket'],
            ['inProgress', 'ringtoneInProgress'],
            ['closing', 'ringtoneClosing'],
        ])('setTvRingtone(%s) writes to column %s', async (slot, column) => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'SPJ', code: 'SPJ' });

            const result = await service.setTvRingtone('site-1', slot, '/uploads/sounds/abc.mp3', 'admin-1');

            expect(result[column as keyof typeof result]).toBe('/uploads/sounds/abc.mp3');
        });

        it('clearTvRingtone sets the column back to null', async () => {
            siteRepo.findOne.mockResolvedValue({
                id: 'site-1',
                name: 'SPJ',
                code: 'SPJ',
                ringtoneClosing: '/uploads/sounds/old.mp3',
            });

            const result = await service.clearTvRingtone('site-1', 'closing', 'admin-1');

            expect(result.ringtoneClosing).toBeNull();
        });

        it('rejects an unknown slot without touching the repository', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'SPJ', code: 'SPJ' });

            await expect(
                service.setTvRingtone('site-1', 'tvToken', '/uploads/sounds/evil.mp3'),
            ).rejects.toThrow(BadRequestException);
            expect(siteRepo.save).not.toHaveBeenCalled();
        });

        it('throws NotFoundException when the site does not exist', async () => {
            siteRepo.findOne.mockResolvedValue(null);

            await expect(
                service.setTvRingtone('missing', 'newTicket', '/uploads/sounds/a.mp3'),
            ).rejects.toThrow(NotFoundException);
        });
    });
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx jest sites.service.spec
```

Harapan: GAGAL. Pesan berupa `service.setTvRingtone is not a function` atau error kompilasi TypeScript bahwa properti `setTvRingtone` tidak ada pada tipe `SitesService`.

- [ ] **Step 3: Implementasi di service**

Buka `apps/backend/src/modules/sites/sites.service.ts`. Ubah baris 1 agar mengimpor `BadRequestException`:

```ts
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
```

Tambahkan tepat di atas dekorator `@Injectable()` (baris 13):

```ts
export type TvRingtoneSlot = 'newTicket' | 'inProgress' | 'closing';

const TV_RINGTONE_COLUMNS: Record<TvRingtoneSlot, 'ringtoneNewTicket' | 'ringtoneInProgress' | 'ringtoneClosing'> = {
    newTicket: 'ringtoneNewTicket',
    inProgress: 'ringtoneInProgress',
    closing: 'ringtoneClosing',
};
```

Lalu tambahkan tiga method berikut setelah `revokeTvToken` (setelah baris 166), sebelum `getServerHostSite`:

```ts
    private resolveRingtoneColumn(slot: string): 'ringtoneNewTicket' | 'ringtoneInProgress' | 'ringtoneClosing' {
        const column = TV_RINGTONE_COLUMNS[slot as TvRingtoneSlot];
        if (!column) {
            throw new BadRequestException(
                `Slot ringtone tidak dikenal: ${slot}. Pilihan: ${Object.keys(TV_RINGTONE_COLUMNS).join(', ')}`,
            );
        }
        return column;
    }

    // ponytail: file ringtone lama dibiarkan di disk saat diganti. File audio
    // kecil, dan menghapus berkas yang mungkin masih dirujuk lebih berisiko
    // daripada menyisakan file yatim. Modul sound berperilaku sama.
    // Tambahkan pembersihan bila direktori uploads/sounds mulai membengkak.
    async setTvRingtone(id: string, slot: string, url: string, userId?: string): Promise<Site> {
        const site = await this.findOne(id);
        const column = this.resolveRingtoneColumn(slot);
        site[column] = url;
        const saved = await this.siteRepo.save(site);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.SITE_UPDATE,
                entityType: 'Site',
                entityId: saved.id,
                description: `Set TV ringtone [${slot}] for site: ${saved.name} (${saved.code})`,
            });
        }

        return saved;
    }

    async clearTvRingtone(id: string, slot: string, userId?: string): Promise<Site> {
        const site = await this.findOne(id);
        const column = this.resolveRingtoneColumn(slot);
        site[column] = null;
        const saved = await this.siteRepo.save(site);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.SITE_UPDATE,
                entityType: 'Site',
                entityId: saved.id,
                description: `Cleared TV ringtone [${slot}] for site: ${saved.name} (${saved.code})`,
            });
        }

        return saved;
    }
```

Perhatikan urutan di `setTvRingtone`: `findOne` dipanggil lebih dulu agar site yang tidak ada melempar `NotFoundException`, lalu slot divalidasi sebelum `save` sehingga slot palsu tidak pernah menyentuh repository.

- [ ] **Step 4: Jalankan test, pastikan lulus**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx jest sites.service.spec
```

Harapan: LULUS. Enam test ringtone baru bertambah di atas test TV token yang sudah ada — `it.each` dengan tiga baris dihitung sebagai tiga test terpisah, ditambah tiga test lainnya. Tidak boleh ada yang GAGAL.

- [ ] **Step 6: Tulis test validasi DTO**

Buat `apps/backend/src/modules/sites/dto/update-site.dto.spec.ts`:

```ts
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSiteDto } from './update-site.dto';

describe('UpdateSiteDto', () => {
    it.each(['25:00', '5pm', '7:00'])('rejects invalid closingTime %s', async (closingTime) => {
        const errors = await validate(plainToInstance(UpdateSiteDto, { closingTime }));

        expect(errors.some((error) => error.property === 'closingTime')).toBe(true);
    });

    it.each(['17:00', '09:30'])('accepts valid closingTime %s', async (closingTime) => {
        const errors = await validate(plainToInstance(UpdateSiteDto, { closingTime }));

        expect(errors).toHaveLength(0);
    });

    it('accepts null to clear a configured closing time', async () => {
        const errors = await validate(plainToInstance(UpdateSiteDto, { closingTime: null }));

        expect(errors).toHaveLength(0);
    });
});
```

- [ ] **Step 7: Jalankan test DTO, pastikan gagal**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx jest update-site.dto.spec
```

Harapan: GAGAL. Nilai `25:00`, `5pm`, dan `7:00` belum ditolak sebelum dekorator `@Matches` ditambahkan.

- [ ] **Step 8: Tambah validasi `closingTime` ke DTO**

Buka `apps/backend/src/modules/sites/dto/create-site.dto.ts`. Ubah baris 1:

```ts
import { IsString, IsOptional, IsBoolean, Length, IsIP, Matches } from 'class-validator';
```

Tambahkan field berikut sebelum kurung tutup kelas:

```ts
    @IsOptional()
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'closingTime harus format HH:mm, contoh 17:00' })
    closingTime?: string | null;
```

`UpdateSiteDto` mewarisi field ini otomatis lewat `PartialType(CreateSiteDto)` (`update-site.dto.ts:4`), jadi `PATCH /sites/:id` langsung menerima `closingTime` tanpa perubahan lain. `@IsOptional()` juga melewati `null`, sehingga admin dapat mengosongkan nilai yang sudah tersimpan dari input `type="time"`.

- [ ] **Step 9: Jalankan test DTO, pastikan lulus**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx jest update-site.dto.spec
```

Harapan: LULUS, 6 test (`it.each` tiga nilai invalid dan dua nilai valid dihitung per nilai, plus test `null`).

- [ ] **Step 10: Verifikasi kompilasi**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx tsc -b --noEmit
```

Harapan: exit code 0.

- [ ] **Step 11: Commit**

```bash
git add apps/backend/src/modules/sites/sites.service.ts apps/backend/src/modules/sites/sites.service.spec.ts apps/backend/src/modules/sites/dto/create-site.dto.ts apps/backend/src/modules/sites/dto/update-site.dto.spec.ts
git commit -m "feat(tv-board): set and clear per-site ringtones with slot validation"
```

---

## Task 3: Route upload dan hapus ringtone

**Files:**
- Modify: `apps/backend/src/modules/sites/sites.controller.ts` (impor di baris 1-19, route baru setelah baris 99)

**Interfaces:**
- Consumes: `SitesService.setTvRingtone(id, slot, url, userId?)` dan `SitesService.clearTvRingtone(id, slot, userId?)` dari Task 2
- Produces: `POST /sites/:id/tv-ringtone` dan `DELETE /sites/:id/tv-ringtone/:slot`, keduanya mengembalikan baris `Site` yang sudah diperbarui

- [ ] **Step 1: Tambah impor yang dibutuhkan**

Buka `apps/backend/src/modules/sites/sites.controller.ts`. Ganti blok impor baris 1-19 seluruhnya dengan:

```ts
import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    ParseUUIDPipe,
    BadRequestException,
    Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { SitesService } from './sites.service';
import { CreateSiteDto, UpdateSiteDto } from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
```

- [ ] **Step 2: Tambah dua route**

Sisipkan tepat setelah method `revokeTvToken` (setelah baris 99, sebelum kurung tutup kelas):

```ts
    @Post(':id/tv-ringtone')
    @ApiOperation({ summary: 'Upload a TV board ringtone for one slot (newTicket | inProgress | closing)' })
    @ApiConsumes('multipart/form-data')
    @Roles(UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/sounds',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname)}`);
            },
        }),
        fileFilter: (req, file, cb) => {
            if (!file.mimetype.startsWith('audio/')) {
                return cb(new Error('Hanya file audio yang diizinkan'), false);
            }
            cb(null, true);
        },
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
    }))
    uploadTvRingtone(
        @Param('id', ParseUUIDPipe) id: string,
        @UploadedFile() file: Express.Multer.File,
        @Body('slot') slot: string,
        @Req() req: any,
    ) {
        if (!file) {
            throw new BadRequestException('File audio wajib diunggah');
        }
        const url = `/uploads/sounds/${file.filename}`;
        return this.sitesService.setTvRingtone(id, slot, url, req.user?.id || req.user?.userId);
    }

    @Delete(':id/tv-ringtone/:slot')
    @ApiOperation({ summary: 'Remove a TV board ringtone from one slot' })
    @Roles(UserRole.ADMIN)
    clearTvRingtone(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('slot') slot: string,
        @Req() req: any,
    ) {
        return this.sitesService.clearTvRingtone(id, slot, req.user?.id || req.user?.userId);
    }
```

Konfigurasi multer di atas identik dengan `sound.controller.ts:80-98`. Guard kelas `@UseGuards(JwtAuthGuard, RolesGuard)` (baris 24) sudah berlaku untuk kedua route, dan `@Roles(UserRole.ADMIN)` membatasinya ke admin, sama seperti route `tv-token`.

Slot tidak divalidasi di controller — validasi tunggal ada di `resolveRingtoneColumn` (Task 2). Satu tempat validasi, tidak ada duplikasi.

- [ ] **Step 3: Verifikasi kompilasi**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx tsc -b --noEmit
```

Harapan: exit code 0.

- [ ] **Step 4: Jalankan seluruh suite backend**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx jest
```

Harapan: LULUS. Sebelum perubahan ini baseline-nya 302 lulus, 0 gagal, 7 dilewati (skipped). Angka lulus bertambah dari test Task 2. Bila ada yang GAGAL, perbaiki sebelum lanjut.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/sites/sites.controller.ts
git commit -m "feat(tv-board): add admin routes to upload and clear TV ringtones"
```

---

## Task 4: Ringtone ikut ke payload TV board

**Files:**
- Modify: `apps/backend/src/modules/tv-board/tv-board.service.ts:19-25` dan `:81-88`
- Modify: `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts` (fixture mock)
- Test: `apps/backend/src/modules/tv-board/tv-board.service.spec.ts`

**Interfaces:**
- Consumes: kolom `Site.ringtoneNewTicket`, `Site.ringtoneInProgress`, `Site.ringtoneClosing`, `Site.closingTime` dari Task 1
- Produces:
  ```ts
  export interface TvBoardRingtones {
      newTicket: string | null;
      inProgress: string | null;
      closing: string | null;
      closingTime: string | null;
  }
  ```
  dan field `ringtones: TvBoardRingtones` pada `TvBoardData`

- [ ] **Step 1: Tulis test yang gagal**

Buka `apps/backend/src/modules/tv-board/tv-board.service.spec.ts`. Sisipkan dua test berikut di dalam `describe('getBoardData', ...)`, tepat sebelum test `'throws NotFoundException when site does not exist'` (baris 147):

```ts
        it('includes per-site ringtones in the payload', async () => {
            siteRepo.findOne.mockResolvedValue({
                id: 'site-1',
                name: 'Sampoerna Jaya',
                code: 'SPJ',
                ringtoneNewTicket: '/uploads/sounds/masuk.mp3',
                ringtoneInProgress: '/uploads/sounds/proses.mp3',
                ringtoneClosing: '/uploads/sounds/pulang.mp3',
                closingTime: '17:00',
            });

            const data = await service.getBoardData('site-1');

            expect(data.ringtones).toEqual({
                newTicket: '/uploads/sounds/masuk.mp3',
                inProgress: '/uploads/sounds/proses.mp3',
                closing: '/uploads/sounds/pulang.mp3',
                closingTime: '17:00',
            });
        });

        it('passes unset ringtones through as null rather than empty strings', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'Sampoerna Jaya', code: 'SPJ' });

            const data = await service.getBoardData('site-1');

            expect(data.ringtones).toEqual({
                newTicket: null,
                inProgress: null,
                closing: null,
                closingTime: null,
            });
        });
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx jest tv-board.service.spec
```

Harapan: GAGAL. Pesan berupa error kompilasi bahwa properti `ringtones` tidak ada pada tipe `TvBoardData`.

- [ ] **Step 3: Tambah tipe dan field payload**

Buka `apps/backend/src/modules/tv-board/tv-board.service.ts`. Sisipkan interface baru sebelum `TvBoardData` (sebelum baris 19):

```ts
export interface TvBoardRingtones {
    newTicket: string | null;
    inProgress: string | null;
    closing: string | null;
    closingTime: string | null;
}
```

Tambahkan satu field di akhir `TvBoardData` (setelah `waitingVendorCount` di baris 24):

```ts
    ringtones: TvBoardRingtones;
```

Tambahkan blok berikut pada objek yang dikembalikan `getBoardData` (setelah `waitingVendorCount,` di baris 86):

```ts
            ringtones: {
                newTicket: site.ringtoneNewTicket ?? null,
                inProgress: site.ringtoneInProgress ?? null,
                closing: site.ringtoneClosing ?? null,
                closingTime: site.closingTime ?? null,
            },
```

`??` dipakai, bukan `||`, agar nilai apa adanya diteruskan tanpa mengubah string kosong menjadi null — kolom ini hanya pernah berisi URL yang sah atau null.

Baris `site` sudah dimuat di baris 48; tidak ada query tambahan.

- [ ] **Step 4: Jalankan test, pastikan lulus**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx jest tv-board.service.spec
```

Harapan: LULUS, 10 test.

- [ ] **Step 5: Sesuaikan fixture gateway**

Buka `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts`. Cari objek yang dikembalikan mock `getBoardData` (berisi `siteName`, `open`, `inProgress`, `waitingVendorCount`). Tambahkan satu properti ke objek itu:

```ts
            ringtones: { newTicket: null, inProgress: null, closing: null, closingTime: null },
```

Bila TypeScript tidak mengeluh, langkah ini boleh dilewati — mock bertipe longgar. Tetap tambahkan agar fixture mencerminkan payload sebenarnya.

- [ ] **Step 6: Jalankan seluruh suite backend**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npx jest
```

Harapan: LULUS, 0 gagal.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/tv-board/
git commit -m "feat(tv-board): send per-site ringtones in board payload"
```

---

## Task 5: Deteksi event bunyi dari snapshot papan

**Files:**
- Create: `apps/frontend/src/features/public/hooks/detectBoardSounds.ts`
- Test: `apps/frontend/src/features/public/hooks/__tests__/detectBoardSounds.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces:
  ```ts
  export type BoardSoundEvent = 'newTicket' | 'inProgress';
  export interface BoardSnapshot { open: string[]; inProgress: string[] }
  export function detectBoardSounds(prev: BoardSnapshot | null, next: BoardSnapshot): BoardSoundEvent[];
  ```

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/frontend/src/features/public/hooks/__tests__/detectBoardSounds.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectBoardSounds } from '../detectBoardSounds';

describe('detectBoardSounds', () => {
    it('stays silent on the first snapshot even when the board is full', () => {
        expect(detectBoardSounds(null, { open: ['a', 'b'], inProgress: ['c'] })).toEqual([]);
    });

    it('reports newTicket when an unseen id appears in open', () => {
        expect(detectBoardSounds(
            { open: ['a'], inProgress: [] },
            { open: ['a', 'b'], inProgress: [] },
        )).toEqual(['newTicket']);
    });

    it('reports inProgress when an id moves from open to in progress', () => {
        expect(detectBoardSounds(
            { open: ['a'], inProgress: [] },
            { open: [], inProgress: ['a'] },
        )).toEqual(['inProgress']);
    });

    it('reports each event once no matter how many tickets triggered it', () => {
        expect(detectBoardSounds(
            { open: ['a', 'b'], inProgress: [] },
            { open: ['x', 'y', 'z'], inProgress: ['a', 'b'] },
        )).toEqual(['newTicket', 'inProgress']);
    });

    it('returns nothing when the board is unchanged', () => {
        expect(detectBoardSounds(
            { open: ['a'], inProgress: ['b'] },
            { open: ['a'], inProgress: ['b'] },
        )).toEqual([]);
    });

    it('ignores tickets that leave the board', () => {
        expect(detectBoardSounds(
            { open: ['a'], inProgress: ['b'] },
            { open: ['a'], inProgress: [] },
        )).toEqual([]);
    });

    it('does not report inProgress for a ticket that was never in open', () => {
        expect(detectBoardSounds(
            { open: [], inProgress: [] },
            { open: [], inProgress: ['a'] },
        )).toEqual([]);
    });
});
```

Test terakhir mengunci keputusan sengaja: tiket yang langsung muncul di In Progress tanpa pernah terlihat di Open tidak membunyikan apa pun. Bunyi In Progress menandai perpindahan, bukan keberadaan.

- [ ] **Step 2: Jalankan test, pastikan gagal**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\frontend"
npx vitest run detectBoardSounds
```

Harapan: GAGAL dengan `Failed to resolve import "../detectBoardSounds"`.

- [ ] **Step 3: Implementasi fungsi**

Buat `apps/frontend/src/features/public/hooks/detectBoardSounds.ts`:

```ts
export type BoardSoundEvent = 'newTicket' | 'inProgress';

export interface BoardSnapshot {
    open: string[];
    inProgress: string[];
}

export function detectBoardSounds(
    prev: BoardSnapshot | null,
    next: BoardSnapshot,
): BoardSoundEvent[] {
    if (!prev) {
        return [];
    }

    const seen = new Set([...prev.open, ...prev.inProgress]);
    const previouslyOpen = new Set(prev.open);

    const events: BoardSoundEvent[] = [];
    if (next.open.some((id) => !seen.has(id))) {
        events.push('newTicket');
    }
    if (next.inProgress.some((id) => previouslyOpen.has(id))) {
        events.push('inProgress');
    }
    return events;
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\frontend"
npx vitest run detectBoardSounds
```

Harapan: LULUS, 7 test.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/public/hooks/detectBoardSounds.ts apps/frontend/src/features/public/hooks/__tests__/detectBoardSounds.test.ts
git commit -m "feat(tv-board): detect ticket sound events from board snapshots"
```

---

## Task 6: Aturan jam pulang

**Files:**
- Create: `apps/frontend/src/features/public/hooks/shouldPlayClosing.ts`
- Test: `apps/frontend/src/features/public/hooks/__tests__/shouldPlayClosing.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces:
  ```ts
  export function toDateKey(date: Date): string;                       // "YYYY-MM-DD"
  export function shouldPlayClosing(now: Date, closingTime: string | null, lastPlayedDate: string | null): boolean;
  ```

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/frontend/src/features/public/hooks/__tests__/shouldPlayClosing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shouldPlayClosing, toDateKey } from '../shouldPlayClosing';

const at = (iso: string) => new Date(iso);

describe('toDateKey', () => {
    it('formats a local date as YYYY-MM-DD with zero padding', () => {
        expect(toDateKey(at('2026-03-07T17:00:00'))).toBe('2026-03-07');
    });
});

describe('shouldPlayClosing', () => {
    it('never fires when no closing time is configured', () => {
        expect(shouldPlayClosing(at('2026-07-26T17:00:00'), null, null)).toBe(false);
    });

    it('fires when the clock matches and it has not fired today', () => {
        expect(shouldPlayClosing(at('2026-07-26T17:00:30'), '17:00', null)).toBe(true);
    });

    it('does not fire twice within the same minute', () => {
        expect(shouldPlayClosing(at('2026-07-26T17:00:45'), '17:00', '2026-07-26')).toBe(false);
    });

    it('fires again the next day', () => {
        expect(shouldPlayClosing(at('2026-07-27T17:00:00'), '17:00', '2026-07-26')).toBe(true);
    });

    it('stays silent outside the configured minute', () => {
        expect(shouldPlayClosing(at('2026-07-26T16:59:59'), '17:00', null)).toBe(false);
        expect(shouldPlayClosing(at('2026-07-26T17:01:00'), '17:00', null)).toBe(false);
    });

    it('fires on weekends too', () => {
        expect(shouldPlayClosing(at('2026-07-25T17:00:00'), '17:00', null)).toBe(true);
        expect(shouldPlayClosing(at('2026-07-26T17:00:00'), '17:00', null)).toBe(true);
    });
});
```

`2026-07-25` jatuh pada Sabtu dan `2026-07-26` pada Minggu; kedua test terakhir mengunci keputusan bahwa jam pulang berbunyi setiap hari.

- [ ] **Step 2: Jalankan test, pastikan gagal**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\frontend"
npx vitest run shouldPlayClosing
```

Harapan: GAGAL dengan `Failed to resolve import "../shouldPlayClosing"`.

- [ ] **Step 3: Implementasi fungsi**

Buat `apps/frontend/src/features/public/hooks/shouldPlayClosing.ts`:

```ts
const pad = (value: number) => String(value).padStart(2, '0');

export function toDateKey(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shouldPlayClosing(
    now: Date,
    closingTime: string | null,
    lastPlayedDate: string | null,
): boolean {
    if (!closingTime) {
        return false;
    }
    const current = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (current !== closingTime) {
        return false;
    }
    return lastPlayedDate !== toDateKey(now);
}
```

Waktu lokal browser dipakai apa adanya. TV berada secara fisik di site-nya, jadi jam perangkat sudah benar dan konversi zona waktu tidak diperlukan.

- [ ] **Step 4: Jalankan test, pastikan lulus**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\frontend"
npx vitest run shouldPlayClosing
```

Harapan: LULUS, 7 test.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/public/hooks/shouldPlayClosing.ts apps/frontend/src/features/public/hooks/__tests__/shouldPlayClosing.test.ts
git commit -m "feat(tv-board): add closing-time rule for the daily ringtone"
```

---

## Task 7: Hook pemutar audio

**Files:**
- Create: `apps/frontend/src/features/public/hooks/useRingtone.ts`
- Test: `apps/frontend/src/features/public/hooks/__tests__/useRingtone.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces: `export function useRingtone(): { enqueue: (urls: Array<string | null>) => void; blocked: boolean }`

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/frontend/src/features/public/hooks/__tests__/useRingtone.test.ts`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRingtone } from '../useRingtone';

let audio: HTMLAudioElement;
const playMock = vi.fn();

beforeEach(() => {
    audio = document.createElement('audio');
    playMock.mockReset();
    playMock.mockResolvedValue(undefined);
    vi.spyOn(audio, 'play').mockImplementation(playMock);
    vi.stubGlobal('Audio', vi.fn(() => audio));
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('useRingtone', () => {
    it('does nothing when every url is null', () => {
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue([null, null]));

        expect(playMock).not.toHaveBeenCalled();
        expect(result.current.blocked).toBe(false);
    });

    it('plays the first queued url', () => {
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/uploads/sounds/a.mp3']));

        expect(playMock).toHaveBeenCalledTimes(1);
    });

    it('waits for ended before playing the next queued url', async () => {
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/uploads/sounds/a.mp3', '/uploads/sounds/b.mp3']));
        expect(playMock).toHaveBeenCalledTimes(1);

        act(() => audio.dispatchEvent(new Event('ended')));
        await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
    });

    it('flags blocked and starts the next queued url when playback is rejected', async () => {
        let resolveSecond: (() => void) | undefined;
        playMock.mockRejectedValueOnce(new DOMException('play() failed', 'NotAllowedError'));
        playMock.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSecond = resolve; }));
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/uploads/sounds/a.mp3', '/uploads/sounds/b.mp3']));

        await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
        expect(result.current.blocked).toBe(true);
        await act(async () => resolveSecond?.());
    });

    it('clears blocked once a later playback succeeds', async () => {
        playMock.mockRejectedValueOnce(new DOMException('play() failed', 'NotAllowedError'));
        playMock.mockResolvedValueOnce(undefined);
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/uploads/sounds/a.mp3', '/uploads/sounds/b.mp3']));

        await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(result.current.blocked).toBe(false));
    });
});
```


- [ ] **Step 2: Jalankan test, pastikan gagal**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\frontend"
npx vitest run useRingtone
```

Harapan: GAGAL dengan `Failed to resolve import "../useRingtone"`.

- [ ] **Step 3: Implementasi hook queue**

Buat `apps/frontend/src/features/public/hooks/useRingtone.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export function useRingtone(): {
    enqueue: (urls: Array<string | null>) => void;
    blocked: boolean;
} {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const queueRef = useRef<string[]>([]);
    const isPlayingRef = useRef(false);
    const [blocked, setBlocked] = useState(false);

    const getAudio = useCallback(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }
        return audioRef.current;
    }, []);

    const playNextRef = useRef<() => void>(() => undefined);

    playNextRef.current = () => {
        if (isPlayingRef.current) {
            return;
        }
        const url = queueRef.current.shift();
        if (!url) {
            return;
        }

        const audio = getAudio();
        isPlayingRef.current = true;
        audio.src = url;
        audio.currentTime = 0;
        audio.play().then(
            () => setBlocked(false),
            () => {
                setBlocked(true);
                isPlayingRef.current = false;
                playNextRef.current();
            },
        );
    };

    const enqueue = useCallback((urls: Array<string | null>) => {
        queueRef.current.push(...urls.filter((url): url is string => Boolean(url)));
        playNextRef.current();
    }, []);

    useEffect(() => {
        const audio = getAudio();
        const handleEnd = () => {
            isPlayingRef.current = false;
            playNextRef.current();
        };
        audio.addEventListener('ended', handleEnd);
        audio.addEventListener('error', handleEnd);
        return () => {
            audio.removeEventListener('ended', handleEnd);
            audio.removeEventListener('error', handleEnd);
            audio.pause();
        };
    }, [getAudio]);

    // Autoplay biasanya diblokir sampai halaman menerima interaksi. TV memakai
    // flag --autoplay-policy=no-user-gesture-required, tapi bila kebetulan ada
    // yang menyentuh layar atau menekan tombol remote, buka kuncinya di situ.
    useEffect(() => {
        const unlock = () => {
            const audio = getAudio();
            audio.play().then(
                () => {
                    audio.pause();
                    setBlocked(false);
                },
                () => undefined,
            );
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
    }, [getAudio]);

    return { enqueue, blocked };
}
```

Catatan review sebelum coding: `audio.play()` pada `unlock` tanpa `src` bisa resolve atau reject berbeda antar-browser. Implementasi nyata harus tidak mengubah `blocked` menjadi `false` dari hasil unlock kosong; hanya panggilan `enqueue` dengan URL valid yang boleh mematikan indikator. Ganti handler sukses `unlock` menjadi `() => audio.pause()`.

- [ ] **Step 4: Jalankan test, pastikan lulus**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\frontend"
npx vitest run useRingtone
```

Harapan: LULUS, 5 test.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/public/hooks/useRingtone.ts apps/frontend/src/features/public/hooks/__tests__/useRingtone.test.ts
git commit -m "feat(tv-board): queue ringtone playback with blocked-autoplay flag"
```

---

## Task 8: Rangkai bunyi ke halaman TV Board

**Files:**
- Modify: `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts:16-22`
- Modify: `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx`
- Test: `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx`

**Interfaces:**
- Consumes:
  - `detectBoardSounds(prev, next)` dan tipe `BoardSnapshot` dari Task 5
  - `shouldPlayClosing(now, closingTime, lastPlayedDate)` dan `toDateKey(date)` dari Task 6
  - `useRingtone()` yang mengembalikan `{ enqueue, blocked }` dari Task 7
  - Field `ringtones` pada payload dari Task 4
- Produces: tipe `TvBoardRingtones` di sisi frontend, dipakai Task 9

- [ ] **Step 1: Cerminkan tipe payload di frontend**

Buka `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts`. Sisipkan interface baru sebelum `TvBoardData` (sebelum baris 16):

```ts
export interface TvBoardRingtones {
    newTicket: string | null;
    inProgress: string | null;
    closing: string | null;
    closingTime: string | null;
}
```

Tambahkan satu field di akhir `TvBoardData` (setelah `waitingVendorCount: number;` di baris 21):

```ts
    ringtones: TvBoardRingtones;
```

- [ ] **Step 2: Tulis test yang gagal untuk indikator**

Buka `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx`.

Tambahkan `ringtones` ke data mock `api.get` (di dalam objek `data`, setelah `waitingVendorCount: 2,` pada baris 19):

```ts
                ringtones: { newTicket: null, inProgress: null, closing: null, closingTime: null },
```

Ganti mock hook socket (baris 25-27) agar dapat dikendalikan per test:

```ts
const socketState = { boardData: null as any, isConnected: true };

vi.mock('../../hooks/useTvBoardSocket', () => ({
    useTvBoardSocket: () => socketState,
}));

const ringtoneState = { blocked: false, enqueue: vi.fn() };

vi.mock('../../hooks/useRingtone', () => ({
    useRingtone: () => ringtoneState,
}));
```

Tambahkan dua test di dalam `describe('BentoTvBoardPage', ...)`, sebelum test terakhir:

```ts
    it('hides the muted indicator while audio plays normally', async () => {
        ringtoneState.blocked = false;
        renderBoard();

        await screen.findByText('Sampoerna Jaya');
        expect(screen.queryByTestId('tv-board-audio-blocked')).toBeNull();
    });

    it('shows the muted indicator when the browser blocks audio', async () => {
        ringtoneState.blocked = true;
        renderBoard();

        expect(await screen.findByTestId('tv-board-audio-blocked')).toBeInTheDocument();
        ringtoneState.blocked = false;
    });
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\frontend"
npx vitest run BentoTvBoardPage
```

Harapan: GAGAL. Test indikator gagal karena `tv-board-audio-blocked` belum ada di DOM.

- [ ] **Step 4: Rangkai queue di halaman**

Buka `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx`.

Ubah baris 1 agar mengimpor `useRef`:

```ts
import React, { useEffect, useRef, useState } from 'react';
```

Ubah baris 3 agar menyertakan ikon `VolumeX`:

```ts
import { Clock, Inbox, CircleDot, AlertTriangle, User, UserCheck, VolumeX } from 'lucide-react';
```

Tambahkan impor berikut setelah baris 7 (`useTvBoardSocket`):

```ts
import { detectBoardSounds, type BoardSnapshot } from '../hooks/detectBoardSounds';
import { shouldPlayClosing, toDateKey } from '../hooks/shouldPlayClosing';
import { useRingtone } from '../hooks/useRingtone';
```

Di dalam komponen `BentoTvBoardPage`, ganti baris 171 sehingga `isConnected` ikut diambil, dan tambahkan state pendukung:

```ts
    const { boardData: liveData, isConnected } = useTvBoardSocket(token);
    const { enqueue, blocked } = useRingtone();
    const prevSnapshotRef = useRef<BoardSnapshot | null>(null);
    const lastClosingDateRef = useRef<string | null>(null);
```

Tambahkan tiga effect berikut setelah effect pengatur jam (setelah baris 186), sebelum `const data = liveData ?? initialData;`:

```ts
    // Socket putus: lupakan snapshot supaya update pertama setelah tersambung
    // ulang tidak membunyikan semburan suara palsu.
    useEffect(() => {
        if (!isConnected) {
            prevSnapshotRef.current = null;
        }
    }, [isConnected]);

    const board = liveData ?? initialData;

    useEffect(() => {
        if (!board) return;

        const snapshot: BoardSnapshot = {
            open: board.open.map((card) => card.id),
            inProgress: board.inProgress.map((card) => card.id),
        };
        const events = detectBoardSounds(prevSnapshotRef.current, snapshot);
        prevSnapshotRef.current = snapshot;

        enqueue(events.map((event) => (
            event === 'newTicket' ? board.ringtones.newTicket : board.ringtones.inProgress
        )));
    }, [board, enqueue]);

    useEffect(() => {
        if (!board) return;
        if (!shouldPlayClosing(now, board.ringtones.closingTime, lastClosingDateRef.current)) return;

        lastClosingDateRef.current = toDateKey(now);
        enqueue([board.ringtones.closing]);
    }, [board, now, enqueue]);

`detectBoardSounds` mengembalikan `newTicket` sebelum `inProgress`, sehingga `enqueue` selalu memutar bunyi Tiket Masuk sebelum bunyi In Progress bila keduanya dipicu oleh update sama. Queue tidak memotong ringtone yang sedang berbunyi; event dari update berikutnya ditambahkan ke belakang antrean.
```

Ganti baris 188 (`const data = liveData ?? initialData;`) dengan:

```ts
    const data = board;
```

Effect harus berada sebelum `if (error)` dan `if (!data)` agar urutan pemanggilan hook tetap sama di setiap render.

Terakhir, tambahkan indikator di header. Di dalam `<div className="flex items-center gap-2">` yang berisi badge Waiting Vendor (baris 242), sisipkan sebagai anak pertama:

```tsx
                        {blocked && (
                            <span
                                data-testid="tv-board-audio-blocked"
                                title="Suara diblokir browser. Jalankan browser dengan --autoplay-policy=no-user-gesture-required."
                                className="rounded-full bg-amber-50 p-1.5 text-amber-600 ring-1 ring-amber-200"
                            >
                                <VolumeX className="h-4 w-4" />
                            </span>
                        )}
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\frontend"
npx vitest run BentoTvBoardPage
```

Harapan: LULUS, 12 test.

- [ ] **Step 6: Jalankan seluruh suite frontend**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\frontend"
npx vitest run
```

Harapan: LULUS, 0 gagal. Baseline sebelum fitur ini 239 lulus; kini bertambah dari Task 5, 6, 7, dan 8.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/public/
git commit -m "feat(tv-board): queue ringtones for ticket events and closing time"
```

---

## Task 9: UI pengaturan ringtone per site

**Files:**
- Modify: `apps/frontend/src/features/settings/components/TvBoardSettings.tsx`

**Interfaces:**
- Consumes:
  - `POST /sites/:id/tv-ringtone` (body `file` + `slot`) dan `DELETE /sites/:id/tv-ringtone/:slot` dari Task 3
  - `PATCH /sites/:id` dengan body `{ closingTime }` dari Task 2
  - Keduanya mengembalikan baris `Site` yang sudah diperbarui
- Produces: tidak ada (task terakhir)

- [ ] **Step 1: Perluas interface Site di komponen**

Buka `apps/frontend/src/features/settings/components/TvBoardSettings.tsx`. Ganti interface `Site` (baris 6-12) dengan:

```ts
interface Site {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    tvToken: string | null;
    ringtoneNewTicket: string | null;
    ringtoneInProgress: string | null;
    ringtoneClosing: string | null;
    closingTime: string | null;
}

type RingtoneSlot = 'newTicket' | 'inProgress' | 'closing';

const RINGTONE_SLOTS: Array<{ slot: RingtoneSlot; field: keyof Site; label: string }> = [
    { slot: 'newTicket', field: 'ringtoneNewTicket', label: 'Tiket Masuk' },
    { slot: 'inProgress', field: 'ringtoneInProgress', label: 'In Progress' },
    { slot: 'closing', field: 'ringtoneClosing', label: 'Jam Pulang' },
];
```

- [ ] **Step 2: Tambah handler unggah, hapus, uji dengar, dan jam pulang**

Ubah baris 2 agar menyertakan ikon baru:

```ts
import { Copy, Play, RefreshCw, Trash2, Tv, Upload } from 'lucide-react';
```

Tambahkan keempat handler berikut setelah `handleCopy` (setelah baris 83), sebelum `if (loading)`:

```ts
    const replaceSite = (updated: Site) =>
        setSites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

    const handleUploadRingtone = async (siteId: string, slot: RingtoneSlot, file: File) => {
        const form = new FormData();
        form.append('file', file);
        form.append('slot', slot);
        setBusyId(siteId);
        try {
            const res = await api.post(`/sites/${siteId}/tv-ringtone`, form);
            replaceSite(res.data);
            toast.success('Ringtone berhasil diunggah');
        } catch {
            toast.error('Gagal mengunggah ringtone. Pastikan file audio dan maksimal 5MB.');
        } finally {
            setBusyId(null);
        }
    };

    const handleClearRingtone = async (siteId: string, slot: RingtoneSlot) => {
        setBusyId(siteId);
        try {
            const res = await api.delete(`/sites/${siteId}/tv-ringtone/${slot}`);
            replaceSite(res.data);
            toast.success('Ringtone dihapus');
        } catch {
            toast.error('Gagal menghapus ringtone');
        } finally {
            setBusyId(null);
        }
    };

    const handlePreview = (url: string) => {
        new Audio(url).play().catch(() => toast.error('Gagal memutar. Cek apakah file masih ada.'));
    };

    const handleClosingTime = async (siteId: string, closingTime: string) => {
        try {
            const res = await api.patch(`/sites/${siteId}`, { closingTime: closingTime || null });
            replaceSite(res.data);
            toast.success('Jam pulang disimpan');
        } catch {
            toast.error('Gagal menyimpan jam pulang');
        }
    };
```

`api.post` dengan `FormData` tidak perlu header `Content-Type` manual — axios menyetelnya beserta boundary secara otomatis.

- [ ] **Step 3: Tambah blok ringtone di setiap baris site**

Struktur baris site saat ini adalah satu `<div className="flex items-center justify-between ...">`. Bungkus ulang agar blok ringtone berada di bawahnya. Ganti seluruh isi `sites.map(...)` (baris 97-137) dengan:

```tsx
            {sites.map((site) => (
                <div key={site.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-white">{site.code} — {site.name}</p>
                            {site.tvToken ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate max-w-md">{boardUrl(site.tvToken)}</p>
                            ) : (
                                <p className="text-xs text-slate-400 mt-1">Belum ada link</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {site.tvToken && (
                                <button
                                    onClick={() => handleCopy(site.tvToken!)}
                                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                                    title="Copy link"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={() => handleGenerate(site.id)}
                                disabled={busyId === site.id}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Generate/regenerate"
                            >
                                <RefreshCw className={`w-4 h-4 ${busyId === site.id ? 'animate-spin' : ''}`} />
                            </button>
                            {site.tvToken && (
                                <button
                                    onClick={() => handleRevoke(site.id)}
                                    disabled={busyId === site.id}
                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600"
                                    title="Revoke"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
                        {RINGTONE_SLOTS.map(({ slot, field, label }) => {
                            const url = site[field] as string | null;
                            return (
                                <div key={slot} className="flex items-center justify-between gap-3">
                                    <span className="text-sm text-slate-600 dark:text-slate-300 w-28 shrink-0">{label}</span>
                                    <span className="text-xs text-slate-400 truncate flex-1">
                                        {url ?? 'Belum ada ringtone'}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {url && (
                                            <button
                                                onClick={() => handlePreview(url)}
                                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                                                title="Uji dengar"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                        )}
                                        <label
                                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                            title="Unggah ringtone"
                                        >
                                            <Upload className="w-4 h-4" />
                                            <input
                                                type="file"
                                                accept="audio/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleUploadRingtone(site.id, slot, file);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                        {url && (
                                            <button
                                                onClick={() => handleClearRingtone(site.id, slot)}
                                                disabled={busyId === site.id}
                                                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600"
                                                title="Hapus ringtone"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        <div className="flex items-center justify-between gap-3 pt-2">
                            <span className="text-sm text-slate-600 dark:text-slate-300 w-28 shrink-0">Jam pulang</span>
                            <input
                                type="time"
                                defaultValue={site.closingTime ?? ''}
                                onBlur={(e) => handleClosingTime(site.id, e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-sm text-slate-700 dark:text-slate-200"
                            />
                        </div>
                    </div>
                </div>
            ))}
```

`e.target.value = ''` mengosongkan input file agar mengunggah file yang sama dua kali berturut-turut tetap memicu `onChange`.

- [ ] **Step 4: Perbarui teks penjelasan**

Ganti paragraf penjelasan (baris 94-96) dengan:

```tsx
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                Generate link kanban tiket per site untuk ditayangkan di layar TV. Generate ulang akan otomatis membatalkan link lama.
                Ringtone diputar di halaman TV saat tiket masuk, saat tiket mulai dikerjakan, dan pada jam pulang.
                Agar suara berbunyi tanpa klik, jalankan browser TV dengan flag <code>--autoplay-policy=no-user-gesture-required</code>.
            </p>
```

- [ ] **Step 5: Verifikasi kompilasi dan build**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\frontend"
npx tsc -b --noEmit
npx vite build
```

Harapan: keduanya exit code 0.

- [ ] **Step 6: Jalankan seluruh suite frontend**

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\frontend"
npx vitest run
```

Harapan: LULUS, 0 gagal.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/settings/components/TvBoardSettings.tsx
git commit -m "feat(tv-board): manage per-site ringtones and closing time in settings"
```

---

## Verifikasi Manual (wajib — tidak tercakup test otomatis)

jsdom tidak memiliki perangkat audio, jadi test otomatis tidak pernah membuktikan ada suara terdengar. Cek berikut harus dijalankan di mini PC sebelum fitur dianggap selesai.

Jalankan migrasi lebih dulu:

```powershell
cd "F:\Program Bagas\SynologyDrive\iDesk-main\apps\backend"
npm run migration:run
```

Lalu:

1. Buka Settings → TV Board. Unggah tiga file audio berbeda untuk satu site. Tekan tombol putar pada masing-masing — ketiganya terdengar berbeda.
2. Isi jam pulang, pindahkan fokus dari input. Muat ulang halaman — nilainya tersimpan.
3. Jalankan halaman TV di mini PC:
   ```
   chrome.exe --kiosk --autoplay-policy=no-user-gesture-required http://<server>/tv/<token>
   ```
   Papan tampil, ikon speaker dicoret **tidak** muncul.
4. Buat tiket baru di site tersebut. Ringtone tiket masuk berbunyi satu kali.
5. Pindahkan tiket itu ke In Progress. Ringtone kedua berbunyi satu kali.
6. Ubah jam pulang ke satu menit ke depan. Ringtone jam pulang berbunyi tepat sekali, tidak berulang selama menit itu.
7. Muat ulang halaman saat papan sudah berisi tiket. Tidak ada bunyi sama sekali.
8. Buka halaman TV di browser biasa tanpa flag autoplay. Ikon speaker dicoret muncul di header, papan tetap berjalan normal.

Bila poin 3 gagal (ikon muncul padahal flag dipasang), periksa apakah shortcut benar-benar memakai flag tersebut dan tidak ada instance Chrome lain yang sudah berjalan — Chrome mengabaikan flag baru bila proses lama masih hidup.
