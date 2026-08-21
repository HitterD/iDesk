# Admin Delete Tickets & Oracle K2 Request — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADMIN dapat menghapus (soft delete) ticket dan Oracle K2 request secara massal dari UI, dengan jejak audit dan tanpa menyentuh baris turunan.

**Architecture:** Tambah `@DeleteDateColumn` pada entity `Ticket`, sehingga TypeORM otomatis menyaring baris terhapus di seluruh query builder dan relasi yang di-join. Satu endpoint `DELETE /tickets/bulk` melayani halaman ticket list maupun Oracle K2, karena keduanya membaca tabel `tickets` yang sama. Frontend menambah tombol Hapus pada dua bar seleksi yang berbeda, dengan dialog konfirmasi ketik-jumlah.

**Tech Stack:** NestJS, TypeORM 0.3.28, PostgreSQL, Jest; React 19 + Vite + TypeScript, TanStack Query, sonner.

**Spec:** `docs/superpowers/specs/2026-08-21-admin-delete-tickets-design.md`

## Global Constraints

- **Jest wajib serial.** Selalu `--runInBand`, **satu file per satu**. Menjalankan paralel membuat mesin hang. Semua perintah test di plan ini sudah memakai bentuk yang benar — jangan diubah.
- **Bahasa output ke user: Indonesia.** Komentar kode dan pesan commit mengikuti gaya codebase (Inggris).
- **Mode hapus: soft delete.** Tidak ada `DELETE FROM`, tidak ada `remove()`, tidak ada cascade ke tabel turunan.
- **Otorisasi: `@Roles(UserRole.ADMIN)` hard-coded.** Bukan lewat `FeatureDefinition`/`PageAccess`.
- **Tidak ada UI restore** di ronde ini.
- **Validasi input eksternal wajib** — pakai DTO ber-`class-validator` yang sudah ada, jangan menerima array mentah.
- **Baca file sebelum edit.** Nomor baris di plan ini adalah snapshot 2026-08-21; verifikasi sebelum mengedit.
- Tabel yang disentuh: hanya `tickets` dan baris preset di `permission_presets`.

---

## File Structure

| Berkas | Tanggung jawab | Aksi |
|--------|----------------|------|
| `apps/backend/src/modules/ticketing/entities/ticket.entity.ts` | Kolom `deletedAt` | Modify |
| `apps/backend/src/migrations/1787366400000-AddDeletedAtToTickets.ts` | Kolom + partial index | Create |
| `apps/backend/src/migrations/1787366401000-RevokeManagerTicketDelete.ts` | Cabut hak Manager yang tersimpan | Create |
| `apps/backend/src/modules/permissions/permissions.service.ts` | Preset Manager untuk instalasi baru | Modify (1 baris) |
| `apps/backend/src/modules/ticketing/services/ticket-update.service.ts` | `bulkSoftDelete` | Modify |
| `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts` | Route `DELETE /tickets/bulk` | Modify |
| `apps/backend/src/modules/notifications/notification-center.service.ts` | 3 SQL mentah | Modify |
| `apps/backend/src/modules/ticketing/services/ticket-soft-delete.spec.ts` | Unit test service | Create |
| `apps/backend/src/modules/ticketing/__tests__/ticket-soft-delete-metadata.spec.ts` | Kunci pendaftaran kolom soft-delete | Create |
| `apps/frontend/src/components/ui/ConfirmationDialog.tsx` | Prop opsional `confirmDisabled` | Modify (3 baris) |
| `apps/frontend/src/features/ticket-board/components/BulkDeleteDialog.tsx` | Dialog ketik-jumlah, dipakai dua halaman | Create |
| `apps/frontend/src/features/ticket-board/components/BulkActionsBar.tsx` | Tombol Hapus (ticket list) | Modify |
| `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx` | Handler + dialog | Modify |
| `apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx` | Tombol Hapus + handler + dialog | Modify |
| `apps/frontend/src/lib/api/tickets.api.ts` | Buang method `delete` yang menunjuk route tak ada | Modify |

**Kenapa `BulkDeleteDialog.tsx` dibuat sebagai komponen tersendiri.** Spec §4.1 menerima bahwa dua *bar* akan menyimpang (itu konsekuensi pilihan D3), tetapi logika konfirmasi ketik-jumlah adalah aturan keselamatan — menduplikasinya di dua halaman berarti ada dua tempat di mana pengaman itu bisa salah. Bar tetap dua; dialognya satu.

---

## Task 1: Kolom `deletedAt` + migration

**Files:**
- Modify: `apps/backend/src/modules/ticketing/entities/ticket.entity.ts`
- Create: `apps/backend/src/migrations/1787366400000-AddDeletedAtToTickets.ts`

**Interfaces:**
- Consumes: —
- Produces: kolom `Ticket.deletedAt: Date`. Setelah task ini, setiap `SELECT` lewat repository otomatis menambahkan `deletedAt IS NULL`.

- [ ] **Step 1: Baca entity dan konfirmasi belum ada soft delete**

Run: `cd apps/backend && grep -n "DeleteDateColumn\|VersionColumn\|^} from 'typeorm'\|from 'typeorm'" src/modules/ticketing/entities/ticket.entity.ts`
Expected: ada `VersionColumn`, **tidak** ada `DeleteDateColumn`.

- [ ] **Step 2: Tambah `DeleteDateColumn` ke import typeorm**

Import berada di baris 1-15. Tambahkan `DeleteDateColumn` ke daftar named import dari `'typeorm'` (urutkan mengikuti gaya yang ada — daftar saat ini memuat `ManyToOne` di baris 7 dan `OneToMany` di baris 8).

- [ ] **Step 3: Tambah kolom di bawah `version`**

Letakkan tepat setelah blok `@VersionColumn({ default: 1 }) version: number;`:

```ts
    /**
     * Soft delete marker. Set by TicketUpdateService.bulkSoftDelete (ADMIN only).
     * TypeORM adds "deletedAt IS NULL" to every repository select and join, so
     * deleted tickets disappear from every read path without per-query changes.
     */
    @DeleteDateColumn()
    deletedAt: Date;
```

- [ ] **Step 4: Buat migration**

Create `apps/backend/src/migrations/1787366400000-AddDeletedAtToTickets.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToTickets1787366400000 implements MigrationInterface {
    name = 'AddDeletedAtToTickets1787366400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`);

        // Partial index: every read now carries "deletedAt IS NULL", and deleted
        // rows are expected to be rare. A full index would waste space on rows
        // that are never scanned.
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tickets_deleted_at" ON "tickets" ("deletedAt") WHERE "deletedAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_tickets_deleted_at"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "deletedAt"`);
    }
}
```

- [ ] **Step 5: Kompilasi**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error baru pada `ticket.entity.ts` atau file migration.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ticketing/entities/ticket.entity.ts apps/backend/src/migrations/1787366400000-AddDeletedAtToTickets.ts
git commit -m "feat(ticketing): add deletedAt soft-delete column to tickets"
```

---

## Task 2: Cabut hak `ticketing.delete` milik Manager

**Files:**
- Modify: `apps/backend/src/modules/permissions/permissions.service.ts:359`
- Create: `apps/backend/src/migrations/1787366401000-RevokeManagerTicketDelete.ts`

**Interfaces:**
- Consumes: —
- Produces: preset Manager tidak lagi mengiklankan hak hapus ticket.

**Kenapa dua langkah.** Mengedit literal preset saja tidak memperbaiki baris yang sudah ada di DB: `seedDefaultPresets` hanya mengisi key yang masih `undefined` (`permissions.service.ts:504-509`), sehingga key yang sudah tersimpan dilewati selamanya. Edit kode memperbaiki instalasi baru; migration memperbaiki instalasi lama.

**Struktur tabel — sudah diverifikasi, jangan diasumsikan ulang.** Dari `permissions/entities/permission-preset.entity.ts` (satu-satunya entity preset di direktori itu):

| Yang dibutuhkan SQL | Nilai sebenarnya |
|---------------------|------------------|
| Nama tabel | `permission_presets` |
| Kolom peran | `targetRole`, nilai `'MANAGER'` |
| Kolom izin | `permissions`, bertipe **`jsonb`** — tidak perlu cast |
| Baris Manager | `name = 'Manager'` (`permissions.service.ts:338`) |

- [ ] **Step 1: Baca preset Manager saat ini**

Run: `cd apps/backend && sed -n '355,362p' src/modules/permissions/permissions.service.ts`
Expected: baris 359 memuat `'ticketing.delete': { canView: true, canCreate: false, canEdit: false, canDelete: true },`

- [ ] **Step 2: Ubah `canDelete` menjadi `false`**

Ganti baris 359 menjadi:

```ts
            'ticketing.delete': { canView: true, canCreate: false, canEdit: false, canDelete: false },
```

Pada blok preset yang sama, baris 339 memuat deskripsi yang kini tidak lagi akurat:

```ts
        description: 'Team manager. Delete tickets, approve requests, full reports, manage renewals.',
```

Ganti menjadi:

```ts
        description: 'Team manager. Approve requests, full reports, manage renewals.',
```

Deskripsi ini tampil di layar pengaturan peran; membiarkannya berbunyi "Delete tickets" setelah haknya dicabut adalah cara paling langsung membuat admin salah paham tentang apa yang bisa dilakukan Manager.

- [ ] **Step 3: Buat migration untuk baris yang sudah tersimpan**

Create `apps/backend/src/migrations/1787366401000-RevokeManagerTicketDelete.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ticket deletion is ADMIN-only. The MANAGER preset advertised a delete right
 * that no endpoint ever enforced; now that a real delete endpoint exists, the
 * stale grant must go.
 *
 * A code change to the preset literal is not enough: seedDefaultPresets only
 * fills keys that are still undefined, so an already-stored key is never
 * revisited. This rewrites the stored row.
 */
export class RevokeManagerTicketDelete1787366401000 implements MigrationInterface {
    name = 'RevokeManagerTicketDelete1787366401000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Argumen keempat jsonb_set = false: jangan pernah menciptakan key pada
        // instalasi yang belum punya. Digabung dengan WHERE ... ? 'ticketing.delete',
        // migration ini hanya bisa mencabut hak, tidak pernah memberi.
        await queryRunner.query(`
            UPDATE "permission_presets"
            SET "permissions" = jsonb_set(
                "permissions",
                '{ticketing.delete,canDelete}',
                'false'::jsonb,
                false
            )
            WHERE "targetRole" = 'MANAGER'
              AND "permissions" ? 'ticketing.delete'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "permission_presets"
            SET "permissions" = jsonb_set(
                "permissions",
                '{ticketing.delete,canDelete}',
                'true'::jsonb,
                false
            )
            WHERE "targetRole" = 'MANAGER'
              AND "permissions" ? 'ticketing.delete'
        `);
    }
}
```

- [ ] **Step 4: Jalankan migration**

Run: `cd apps/backend && npm run migration:run`
Expected: kedua migration (Task 1 & 2) sukses tanpa error.

- [ ] **Step 5: Verifikasi hasil di DB**

Jalankan lewat klien psql pada database aplikasi:

```sql
SELECT "name", "targetRole", "permissions"->'ticketing.delete'
FROM permission_presets
WHERE "targetRole" = 'MANAGER';
```

Expected: `canDelete` bernilai `false`.

Bila query tidak mengembalikan baris sama sekali, artinya preset Manager belum pernah di-seed di DB ini. Itu bukan kegagalan — instalasi tersebut akan mengambil nilai yang sudah benar dari Step 2 saat seeding pertama.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/permissions/permissions.service.ts apps/backend/src/migrations/1787366401000-RevokeManagerTicketDelete.ts
git commit -m "fix(permissions): revoke stale ticketing.delete grant from MANAGER preset"
```

---

## Task 3: `bulkSoftDelete` di service (TDD)

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.ts`
- Create: `apps/backend/src/modules/ticketing/services/ticket-soft-delete.spec.ts`

**Interfaces:**
- Consumes: `Ticket.deletedAt` (Task 1).
- Produces:
  ```ts
  bulkSoftDelete(ticketIds: string[], userId: string): Promise<{ deleted: number; failed: string[] }>
  ```
  Dipakai controller di Task 4.

**Konstruktor `TicketUpdateService` punya 14 argumen** (baris 30-52), berurutan: `ticketRepo`, `messageRepo`, `userRepo`, `slaConfigRepo`, `eventsGateway`, `surveysService`, `cacheService`, `cacheInvalidationService`, `eventEmitter`, `telegramService`, `businessHoursService`, `auditService`, `dataSource`, `workloadService`. Test di bawah mengikuti urutan itu persis (pola yang sama dipakai `ticket-update.service.spec.ts:61-76`).

- [ ] **Step 1: Tulis test yang gagal**

Create `apps/backend/src/modules/ticketing/services/ticket-soft-delete.spec.ts`:

```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketUpdateService } from './ticket-update.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { Ticket, TicketStatus, TicketPriority } from '../entities/ticket.entity';

describe('TicketUpdateService.bulkSoftDelete', () => {
    let service: any;
    let mockTicketRepo: any;
    let mockUserRepo: any;
    let mockAuditService: any;
    let softRemoved: Ticket[];

    const buildTicket = (id: string, siteId: string | null = 'site-1'): Ticket => ({
        id,
        ticketNumber: `TCK-${id}`,
        title: `Ticket ${id}`,
        status: TicketStatus.TODO,
        priority: TicketPriority.MEDIUM,
        siteId,
    } as Ticket);

    const buildUser = (role: UserRole, siteId: string | null = 'site-1') => ({
        id: 'actor-1',
        fullName: 'Actor',
        email: 'actor@test.com',
        role,
        siteId,
    });

    beforeEach(() => {
        softRemoved = [];
        mockTicketRepo = { find: jest.fn() };
        mockUserRepo = { findOne: jest.fn() };
        mockAuditService = { logAsync: jest.fn() };

        // The service runs softRemove inside a transaction; the manager is the
        // only part the spec needs to observe.
        const manager = {
            softRemove: jest.fn(async (entity: Ticket) => {
                softRemoved.push(entity);
                return entity;
            }),
        };
        const mockDataSource = {
            transaction: jest.fn(async (cb: any) => cb(manager)),
        };

        service = new TicketUpdateService(
            mockTicketRepo,
            {} as any,        // messageRepo
            mockUserRepo,
            {} as any,        // slaConfigRepo
            {} as any,        // eventsGateway
            {} as any,        // surveysService
            {} as any,        // cacheService
            {} as any,        // cacheInvalidationService
            { emit: jest.fn() } as any,
            null as any,      // telegramService
            null as any,      // businessHoursService
            mockAuditService,
            mockDataSource as any,
            {} as any,        // workloadService
        );
    });

    it('soft-deletes every requested ticket for an ADMIN', async () => {
        mockUserRepo.findOne.mockResolvedValue(buildUser(UserRole.ADMIN, null));
        mockTicketRepo.find.mockResolvedValue([buildTicket('a'), buildTicket('b')]);

        const result = await service.bulkSoftDelete(['a', 'b'], 'actor-1');

        expect(result.deleted).toBe(2);
        expect(result.failed).toEqual([]);
        expect(softRemoved.map((t) => t.id).sort()).toEqual(['a', 'b']);
    });

    it('reports unknown ids as failed without aborting the rest', async () => {
        mockUserRepo.findOne.mockResolvedValue(buildUser(UserRole.ADMIN, null));
        mockTicketRepo.find.mockResolvedValue([buildTicket('a')]);

        const result = await service.bulkSoftDelete(['a', 'ghost'], 'actor-1');

        expect(result.deleted).toBe(1);
        expect(result.failed).toEqual(['ghost']);
        expect(softRemoved.map((t) => t.id)).toEqual(['a']);
    });

    it('records one audit entry per deleted ticket', async () => {
        mockUserRepo.findOne.mockResolvedValue(buildUser(UserRole.ADMIN, null));
        mockTicketRepo.find.mockResolvedValue([buildTicket('a')]);

        await service.bulkSoftDelete(['a'], 'actor-1');

        expect(mockAuditService.logAsync).toHaveBeenCalledTimes(1);
        expect(mockAuditService.logAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'actor-1',
                action: AuditAction.DELETE_TICKET,
                entityType: 'ticket',
                entityId: 'a',
                oldValue: expect.objectContaining({ ticketNumber: 'TCK-a' }),
            }),
        );
    });

    it('throws NotFoundException when the actor does not exist', async () => {
        mockUserRepo.findOne.mockResolvedValue(null);

        await expect(service.bulkSoftDelete(['a'], 'ghost-actor'))
            .rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when no ticket matches', async () => {
        mockUserRepo.findOne.mockResolvedValue(buildUser(UserRole.ADMIN, null));
        mockTicketRepo.find.mockResolvedValue([]);

        await expect(service.bulkSoftDelete(['ghost'], 'actor-1'))
            .rejects.toBeInstanceOf(NotFoundException);
    });

    it('aborts the whole batch when a site-locked actor targets another site', async () => {
        // Guard is defence in depth: ADMIN is cross-site today, but the check
        // must fail closed if authorization is ever loosened.
        mockUserRepo.findOne.mockResolvedValue(buildUser(UserRole.AGENT, 'site-1'));
        mockTicketRepo.find.mockResolvedValue([buildTicket('a', 'site-1'), buildTicket('b', 'site-2')]);

        await expect(service.bulkSoftDelete(['a', 'b'], 'actor-1'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(softRemoved).toEqual([]);
    });
});
```

- [ ] **Step 2: Jalankan test — pastikan GAGAL**

Run: `cd apps/backend && npx jest --runInBand src/modules/ticketing/services/ticket-soft-delete.spec.ts`
Expected: FAIL — `service.bulkSoftDelete is not a function`.

- [ ] **Step 3: Implementasi `bulkSoftDelete`**

Tambahkan di `ticket-update.service.ts`, tepat setelah method `bulkUpdate` berakhir (cari `async bulkUpdate(` di sekitar baris 457 lalu letakkan setelah penutupnya). Semua import yang dibutuhkan sudah ada di baris 1-24 (`In`, `NotFoundException`, `UserRole`, `AuditAction`, `validateTicketSiteAccess`) — tidak ada import baru.

```ts
    /**
     * Soft-deletes tickets in bulk. ADMIN-only — enforced by @Roles on the route.
     *
     * Soft, not hard: seven tables reference ticketId, and none of them should be
     * cascaded away by a delete that an operator may need to undo.
     */
    async bulkSoftDelete(
        ticketIds: string[],
        userId: string,
    ): Promise<{ deleted: number; failed: string[] }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const tickets = await this.ticketRepo.find({ where: { id: In(ticketIds) } });
        if (tickets.length === 0) {
            throw new NotFoundException('No tickets found');
        }

        // Site isolation, fail-closed: one out-of-site ticket aborts the whole
        // batch, before anything is written.
        for (const ticket of tickets) {
            validateTicketSiteAccess(
                user.role as UserRole,
                (user as any).siteId ?? null,
                (ticket as any).siteId ?? null,
            );
        }

        const found = new Set(tickets.map((t) => t.id));
        const failed = ticketIds.filter((id) => !found.has(id));

        await this.dataSource.transaction(async (manager) => {
            for (const ticket of tickets) {
                await manager.softRemove(ticket);
            }
        });

        // Audit after commit: logAsync is fire-and-forget, so a logging failure
        // must never be able to roll back a delete that already happened.
        for (const ticket of tickets) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.DELETE_TICKET,
                entityType: 'ticket',
                entityId: ticket.id,
                oldValue: {
                    ticketNumber: ticket.ticketNumber,
                    title: ticket.title,
                    status: ticket.status,
                    siteId: (ticket as any).siteId ?? null,
                },
                description: `Ticket "${ticket.ticketNumber}" deleted (soft) by ${user.fullName}`,
            });
        }

        this.logger.log(`Soft-deleted ${tickets.length} ticket(s) by user ${userId}`);

        return { deleted: tickets.length, failed };
    }
```

**Kenapa `(user as any).siteId` dan bukan `user.siteId`.** Kedua entity sebenarnya sudah mendeklarasikan kolomnya (`user.entity.ts:96`, `ticket.entity.ts:112`), jadi cast itu secara teknis tidak dibutuhkan. Tetap dipakai karena seluruh file ini melakukan hal yang sama — baris 74, 194-195, 292-293, 311-312 — dan menyimpang di satu method baru akan membuat file tidak konsisten. Membersihkan semuanya sekaligus adalah refactor tersendiri di luar cakupan (CLAUDE.md §6 — ikuti pattern codebase; §10 — refactor tak diminta = P3).

- [ ] **Step 4: Jalankan test — pastikan LULUS**

Run: `cd apps/backend && npx jest --runInBand src/modules/ticketing/services/ticket-soft-delete.spec.ts`
Expected: PASS, 6 test.

- [ ] **Step 5: Regresi pada spec service yang sudah ada**

Run: `cd apps/backend && npx jest --runInBand src/modules/ticketing/services/ticket-update.service.spec.ts`
Expected: PASS, tidak ada test yang rusak.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-update.service.ts apps/backend/src/modules/ticketing/services/ticket-soft-delete.spec.ts
git commit -m "feat(ticketing): add bulkSoftDelete with site isolation and audit trail"
```

---

## Task 4: Endpoint `DELETE /tickets/bulk`

**Files:**
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts`

**Interfaces:**
- Consumes: `bulkSoftDelete(ticketIds, userId)` (Task 3); `BulkDeleteTicketsDto` dari `../dto/bulk-update.dto` (sudah ada, baris 32, belum pernah dipakai).
- Produces: `DELETE /tickets/bulk` → `{ deleted: number; failed: string[] }`.

- [ ] **Step 1: Tambah `Delete` ke import `@nestjs/common`**

Import block ada di baris 1-16 dan **belum** memuat `Delete`. Tambahkan setelah `Post,` agar mengikuti urutan yang ada.

- [ ] **Step 2: Tambah import DTO**

Di sebelah `import { BulkUpdateTicketsDto } from '../dto/bulk-update.dto';` (baris 38), ubah menjadi:

```ts
import { BulkUpdateTicketsDto, BulkDeleteTicketsDto } from '../dto/bulk-update.dto';
```

- [ ] **Step 3: Tambah route**

Letakkan tepat setelah method `bulkUpdate` (berakhir di sekitar baris 315), sebelum `@Post('merge')`:

```ts
    @Delete('bulk')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Soft-delete multiple tickets (ADMIN only)' })
    @ApiResponse({ status: 200, description: 'Tickets deleted successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required.' })
    async bulkDelete(
        @Body() dto: BulkDeleteTicketsDto,
        @Request() req: any,
    ): Promise<{ deleted: number; failed: string[] }> {
        return this.ticketUpdateService.bulkSoftDelete(dto.ticketIds, req.user.userId);
    }
```

Path literal `'bulk'` diletakkan bersama route statis lain; ia tidak bentrok dengan `@Get(':id')` karena berbeda HTTP method.

- [ ] **Step 4: Verifikasi guard terpasang**

Run: `cd apps/backend && sed -n '44,47p' src/modules/ticketing/presentation/tickets.controller.ts`
Expected: `@UseGuards(JwtAuthGuard, RolesGuard)` di level controller — `@Roles(UserRole.ADMIN)` baru punya efek karena ini.

- [ ] **Step 5: Kompilasi**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error baru.

- [ ] **Step 6: Regresi controller spec**

Run: `cd apps/backend && npx jest --runInBand src/modules/ticketing/presentation/tickets.controller.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/ticketing/presentation/tickets.controller.ts
git commit -m "feat(ticketing): expose ADMIN-only DELETE /tickets/bulk endpoint"
```

---

## Task 5: Perbaiki 3 SQL mentah di notification-center

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts:327,331,335`

**Interfaces:**
- Consumes: kolom `deletedAt` (Task 1).
- Produces: —

**Kenapa hanya tiga baris.** Query builder yang berangkat dari repository mewarisi filter soft-delete secara otomatis, termasuk pada relasi yang di-join (`SelectQueryBuilder.js:1008-1013`) dan entity utama (`QueryBuilder.js:544-557`). `dataSource.createQueryBuilder`/`entityManager.createQueryBuilder` tidak dipakai di mana pun. Yang lolos hanyalah `entityManager.query()` dengan SQL literal, karena itu melewati metadata sepenuhnya.

- [ ] **Step 1: Lihat ketiga query dan preseden di baris 347**

Run: `cd apps/backend && sed -n '325,348p' src/modules/notifications/notification-center.service.ts`
Expected: tiga `FROM tickets ...` tanpa `deletedAt`, dan satu `FROM renewal_contracts ... AND "deletedAt" IS NULL` sebagai contoh gaya yang sudah dipakai.

- [ ] **Step 2: Tambahkan filter pada query SLA breached (baris 327)**

```ts
                `SELECT id, "ticketNumber", title, "createdAt", "updatedAt" FROM tickets WHERE "assignedToId" = $1 AND status != 'RESOLVED' AND "slaTarget" < $2 AND "deletedAt" IS NULL ORDER BY "slaTarget" ASC LIMIT 50`,
```

- [ ] **Step 3: Tambahkan filter pada query unresponded (baris 331)**

```ts
                `SELECT id, "ticketNumber", title, "createdAt" FROM tickets WHERE "assignedToId" = $1 AND status = 'TODO' AND "createdAt" < $2 AND "deletedAt" IS NULL ORDER BY "createdAt" ASC LIMIT 50`,
```

- [ ] **Step 4: Tambahkan filter pada query resolved (baris 335)**

```ts
                `SELECT id, "ticketNumber", title, "updatedAt" FROM tickets WHERE "userId" = $1 AND status = 'RESOLVED' AND "deletedAt" IS NULL ORDER BY "updatedAt" DESC LIMIT 50`,
```

- [ ] **Step 5: Verifikasi tidak ada SQL mentah `tickets` lain yang terlewat**

Run: `cd apps/backend && grep -rn "FROM tickets" src --include=*.ts | grep -v spec`
Expected: hanya tiga baris di atas (kini semuanya ber-`deletedAt IS NULL`) plus `health.service.ts:288,320`. Dua yang terakhir adalah `SELECT 1 FROM tickets LIMIT 1` — probe konektivitas, tidak membaca data, **sengaja dibiarkan**.

- [ ] **Step 6: Kompilasi**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error baru.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts
git commit -m "fix(notifications): exclude soft-deleted tickets from raw SQL queries"
```

---

## Task 6: Kunci pendaftaran kolom soft-delete

**Files:**
- Create: `apps/backend/src/modules/ticketing/__tests__/ticket-soft-delete-metadata.spec.ts`

**Interfaces:**
- Consumes: `Ticket.deletedAt` (Task 1).
- Produces: —

**Kenapa uji metadata, bukan uji DB.** Suite ini tidak punya infrastruktur database test — `grep -rln "createTestingModule" src/modules/ticketing/` mengembalikan kosong; seluruh spec ticketing memakai mock. Menulis "uji integrasi" di atas mock berarti menguji mock, bukan TypeORM, dan itu lebih buruk daripada tidak menguji: ia memberi rasa aman palsu tentang properti yang justru menjadi tumpuan seluruh desain.

Yang **bisa** diuji tanpa DB adalah prasyaratnya. TypeORM menyuntikkan `deletedAt IS NULL` hanya bila entity mendaftarkan kolom bermode `deleteDate` — `DeleteDateColumn.js` mendaftarkan `mode: "deleteDate"` ke `getMetadataArgsStorage()`, lalu `QueryBuilder.js:544` (entity utama) dan `SelectQueryBuilder.js:1008` (join) membacanya. Bila pendaftaran itu hilang — dekorator terhapus, salah import, atau berubah di upgrade TypeORM — setiap jalur baca di aplikasi diam-diam membocorkan ticket terhapus. Test ini menangkap persis kondisi itu.

Pendekatan `getMetadataArgsStorage()` sudah diverifikasi jalan tanpa koneksi DB pada entity yang sudah punya soft delete (`Article` → `['deletedAt']`). `new DataSource(...).getMetadata()` **tidak** dipakai karena menuntut metadata sudah ter-build lewat inisialisasi.

- [ ] **Step 1: Tulis test**

Create `apps/backend/src/modules/ticketing/__tests__/ticket-soft-delete-metadata.spec.ts`:

```ts
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';

/**
 * The entire delete design rests on one property: TypeORM appends
 * "deletedAt IS NULL" to every repository select (QueryBuilder.js:544) and to
 * every join (SelectQueryBuilder.js:1008) — but only when the entity registers
 * a column with mode "deleteDate".
 *
 * If this ever fails, every read path in the app is exposing deleted tickets.
 * Treat it as a P0, not as a broken test.
 */
describe('Ticket soft-delete metadata', () => {
    const deleteDateColumns = () =>
        getMetadataArgsStorage().columns.filter(
            (c) => c.target === Ticket && c.mode === 'deleteDate',
        );

    it('registers exactly one delete date column', () => {
        expect(deleteDateColumns()).toHaveLength(1);
    });

    it('names that column deletedAt', () => {
        expect(deleteDateColumns()[0].propertyName).toBe('deletedAt');
    });
});
```

- [ ] **Step 2: Jalankan test**

Run: `cd apps/backend && npx jest --runInBand src/modules/ticketing/__tests__/ticket-soft-delete-metadata.spec.ts`
Expected: PASS, 2 test — Task 1 sudah menambahkan dekoratornya.

- [ ] **Step 3: Buktikan test ini benar-benar bisa gagal**

Test yang lulus tanpa pernah bisa gagal tidak membuktikan apa pun. Beri komentar sementara pada `@DeleteDateColumn()` di `ticket.entity.ts`, jalankan ulang perintah Step 2, pastikan **FAIL**, lalu kembalikan dekoratornya dan jalankan sekali lagi untuk memastikan PASS.

Run: `cd apps/backend && git diff --stat src/modules/ticketing/entities/ticket.entity.ts`
Expected: kosong — entity sudah kembali persis seperti semula setelah percobaan.

- [ ] **Step 4: Regresi isolasi site**

Jalankan **satu per satu**, jangan digabung:

Run: `cd apps/backend && npx jest --runInBand src/modules/ticketing/services/ticket-query.site-isolation.spec.ts`
Expected: PASS.

Run: `cd apps/backend && npx jest --runInBand src/modules/ticketing/__tests__/cross-site-smoke.spec.ts`
Expected: PASS.

Run: `cd apps/backend && npx jest --runInBand src/modules/workload/workload.site-isolation.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ticketing/__tests__/ticket-soft-delete-metadata.spec.ts
git commit -m "test(ticketing): lock in soft-delete column registration"
```

---

## Task 7: Buang `ticketApi.delete` yang mati

**Files:**
- Modify: `apps/frontend/src/lib/api/tickets.api.ts:45-49`

**Interfaces:**
- Consumes: —
- Produces: —

`ticketApi.delete` (baris 48-49) memanggil `DELETE /tickets/:id` yang **tidak pernah ada** di controller — dead code yang akan menghasilkan 404 bila dipakai. Setelah Task 4, ada route hapus sungguhan tetapi bentuknya berbeda (`DELETE /tickets/bulk` dengan body). Membiarkan method lama berdiri adalah jebakan langsung: pembaca berikutnya memanggil `ticketApi.delete(id)`, mengira itu jalur resmi, dan mendapat 404.

**Kenapa tidak sekalian menambahkan `ticketApi.bulkDelete`.** Karena tidak akan ada yang memakainya. `grep -rln "ticketApi" src/` hanya menemukan dua berkas: definisinya sendiri dan `lib/api/index.ts` yang me-re-export-nya — **nol halaman** memakai lapisan ini. Halaman ticket list memanggil endpoint bulk lewat `api.patch('/tickets/bulk/assign', ...)` (baris 345) dan `api.patch('/tickets/bulk/update', ...)` (baris 358) secara langsung. Handler hapus di Task 9/10 mengikuti pola tetangganya itu (CLAUDE.md §4 — ikuti pattern existing), sehingga menambah `bulkDelete` di sini hanya akan menciptakan dead code baru sambil menghapus yang lama.

Preseden pemanggilan DELETE ber-body ada di `useSnoozeActionItem.ts:31` — `api.delete('/notifications/action-items/snooze', { data: variables })`.

- [ ] **Step 1: Konfirmasi tidak ada pemanggil**

Run: `cd apps/frontend && grep -rn "ticketApi\.delete\|ticketsApi\.delete" src/`
Expected: kosong.

- [ ] **Step 2: Hapus method `delete`**

Hapus blok baris 45-49 seluruhnya:

```ts
    /**
     * Delete a ticket
     */
    delete: (id: string) =>
        api.delete(`/tickets/${id}`),
```

Jangan menyisakan koma ganda atau baris kosong ganda pada objek `ticketApi`.

- [ ] **Step 3: Typecheck**

Run: `cd apps/frontend && npx tsc -p tsconfig.app.json --noEmit`
Expected: tidak ada error baru pada `tickets.api.ts` maupun `lib/api/index.ts`.

Catatan: `ClientTicketDetailPage.tsx` memunculkan 6 error TS yang **sudah ada sebelum plan ini** (properti `email`/`site` pada tipe `{ id, fullName }`), berasal dari pekerjaan lain yang belum di-commit. Abaikan; jangan perbaiki di plan ini.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/lib/api/tickets.api.ts
git commit -m "chore(api): drop dead ticketApi.delete pointing at a nonexistent route"
```

---

## Task 8: Dialog konfirmasi ketik-jumlah

**Files:**
- Modify: `apps/frontend/src/components/ui/ConfirmationDialog.tsx:7-19` (props), `:48-59` (destructuring), `:142` (tombol)
- Create: `apps/frontend/src/features/ticket-board/components/BulkDeleteDialog.tsx`

**Interfaces:**
- Consumes: `ConfirmationDialog` dari `@/components/ui/ConfirmationDialog` — sudah mendukung `variant="destructive"` dan slot `children` (interface baris 18, render baris 127).
- Produces:
  ```ts
  interface BulkDeleteDialogProps {
      isOpen: boolean;
      ticketNumbers: string[];
      isLoading?: boolean;
      onConfirm: () => void;
      onCancel: () => void;
  }
  export const BulkDeleteDialog: React.FC<BulkDeleteDialogProps>
  ```
  Dipakai Task 9 dan Task 10.

**Kenapa `ConfirmationDialog` tetap disentuh meski spec §4.2 menyatakan tidak perlu.** Spec benar bahwa slot `children` sudah cukup untuk *menampung* input jumlah. Tetapi tombol Konfirmasi di baris 139-142 hanya menerima `disabled={isLoading}` — tidak ada cara mematikannya selagi angka belum cocok. Tanpa itu, tombol Hapus tampak aktif padahal klik tidak melakukan apa-apa: pengguna menekan, tidak terjadi apa pun, tanpa penjelasan. Perubahan ini aditif (prop opsional, default `false`), jadi seluruh pemakai `ConfirmationDialog` lain tidak berubah perilakunya. Kelas `disabled:opacity-50 disabled:cursor-not-allowed` sudah terpasang di baris 148, sehingga keadaan nonaktif langsung terlihat tanpa CSS tambahan.

- [ ] **Step 1: Tambah prop `confirmDisabled` ke interface**

Pada `ConfirmationDialogProps`, tambahkan tepat setelah `isLoading?: boolean;` (baris 16):

```tsx
    /** Blocks confirmation while a precondition is unmet (e.g. an unconfirmed input). */
    confirmDisabled?: boolean;
```

- [ ] **Step 2: Terima prop di destructuring**

Pada blok destructuring (baris 48-59), tambahkan tepat setelah `isLoading = false,`:

```tsx
    confirmDisabled = false,
```

- [ ] **Step 3: Terapkan pada tombol Konfirmasi**

Baris 142 saat ini:

```tsx
                        disabled={isLoading}
```

Ada **dua** baris `disabled={isLoading}` di file ini — baris 134 (tombol Batal) dan baris 142 (tombol Konfirmasi). Yang diubah hanya baris 142, yaitu yang berada di dalam `<button>` ber-`onClick={onConfirm}`:

```tsx
                        disabled={isLoading || confirmDisabled}
```

Tombol Batal harus tetap `disabled={isLoading}` saja — membatalkan tidak boleh ikut terkunci hanya karena angka belum diketik.

- [ ] **Step 4: Verifikasi pemakai lain tidak rusak**

Run: `cd apps/frontend && grep -rln "ConfirmationDialog" src/`
Expected: daftar pemakai. Karena `confirmDisabled` opsional dan default `false`, tidak ada satu pun yang perlu diubah — perilaku lama tetap identik.

- [ ] **Step 5: Buat komponen dialog**

Create `apps/frontend/src/features/ticket-board/components/BulkDeleteDialog.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

interface BulkDeleteDialogProps {
    isOpen: boolean;
    ticketNumbers: string[];
    isLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const MAX_LISTED = 8;

/**
 * Type-the-count confirmation for bulk ticket deletion.
 *
 * There is no restore UI, so an accidental delete is only recoverable through a
 * production database query. This deliberate friction is the sole safeguard
 * standing between a stray click and that outcome — keep it in one place rather
 * than duplicating it per page.
 */
export const BulkDeleteDialog: React.FC<BulkDeleteDialogProps> = ({
    isOpen,
    ticketNumbers,
    isLoading,
    onConfirm,
    onCancel,
}) => {
    const [typed, setTyped] = useState('');
    const count = ticketNumbers.length;

    // Reset on every open so a previous confirmation can never carry over.
    useEffect(() => {
        if (isOpen) setTyped('');
    }, [isOpen]);

    const matches = typed.trim() === String(count);
    const listed = ticketNumbers.slice(0, MAX_LISTED).join(', ');
    const overflow = count - MAX_LISTED;
    const tail = 'Ticket akan hilang dari semua daftar dan tidak dapat dipulihkan lewat aplikasi.';

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            title={`Hapus ${count} ticket?`}
            description={
                overflow > 0
                    ? `${listed}, dan ${overflow} lainnya. ${tail}`
                    : `${listed}. ${tail}`
            }
            variant="destructive"
            confirmText="Hapus"
            cancelText="Batal"
            isLoading={isLoading}
            confirmDisabled={!matches}
            onConfirm={onConfirm}
            onCancel={onCancel}
        >
            <label className="block text-sm text-slate-600 dark:text-slate-300">
                Ketik <span className="font-mono font-bold">{count}</span> untuk konfirmasi:
                <input
                    type="text"
                    inputMode="numeric"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                />
            </label>
            {typed.length > 0 && !matches && (
                <p className="mt-2 text-sm text-red-500">Angka belum cocok.</p>
            )}
        </ConfirmationDialog>
    );
};
```

- [ ] **Step 6: Typecheck**

Run: `cd apps/frontend && npx tsc -p tsconfig.app.json --noEmit`
Expected: tidak ada error baru pada `BulkDeleteDialog.tsx` atau `ConfirmationDialog.tsx`.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/ticket-board/components/BulkDeleteDialog.tsx apps/frontend/src/components/ui/ConfirmationDialog.tsx
git commit -m "feat(ticket-board): add type-the-count bulk delete confirmation dialog"
```

---

## Task 9: Tombol Hapus di halaman ticket list

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/components/BulkActionsBar.tsx`
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx`

**Interfaces:**
- Consumes: `BulkDeleteDialog` (Task 8); endpoint `DELETE /tickets/bulk` (Task 4), dipanggil lewat `api.delete` langsung — sama seperti dua handler bulk tetangganya di baris 345 dan 358.
- Produces: `BulkActionsBarProps.onDelete?: () => void` — opsional, sehingga pemakai lain tidak rusak.

- [ ] **Step 1: Tambah prop `onDelete` ke `BulkActionsBar`**

Ubah interface (baris 5-11) menjadi:

```tsx
interface BulkActionsBarProps {
    selectedCount: number;
    onAssign: () => void;
    onChangeStatus: (status: string) => void;
    onClear: () => void;
    isLoading?: boolean;
    /** Rendered only when provided — ADMIN-only in practice. */
    onDelete?: () => void;
}
```

Lalu ganti destructuring (baris 13-19) menjadi:

```tsx
export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount,
    onAssign,
    onChangeStatus,
    onClear,
    isLoading,
    onDelete,
}) => {
```

- [ ] **Step 2: Render tombol Hapus**

`Trash2` sudah di-import di baris 2 tetapi belum pernah dirender. Tambahkan di dalam blok Actions (`<div className="flex items-center gap-2">`, baris 34-61), setelah tombol In Progress:

```tsx
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Hapus</span>
                        </button>
                    )}
```

- [ ] **Step 3: Tambah state dan handler di `BentoTicketListPage`**

Halaman sudah punya `isAdmin` (baris 223), `selectedTickets`, `clearSelection`, `queryClient`, `api`, dan `toast`. Tambahkan state di dekat state seleksi lainnya:

```tsx
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
```

Tambahkan handler tepat setelah `handleBulkStatusChange` (berakhir baris 366), mengikuti pola yang sama persis:

```tsx
    const handleBulkDelete = useCallback(async () => {
        const ticketIds = Array.from(selectedTickets);
        setIsDeleting(true);
        try {
            const res = await api.delete('/tickets/bulk', { data: { ticketIds } });
            const deleted = res.data?.deleted ?? ticketIds.length;
            const failed = res.data?.failed?.length ?? 0;
            toast.success(
                failed > 0
                    ? `${deleted} ticket dihapus, ${failed} gagal`
                    : `${deleted} ticket dihapus`,
            );
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            clearSelection();
            setDeleteDialogOpen(false);
        } catch (error) {
            toast.error('Gagal menghapus ticket');
        } finally {
            setIsDeleting(false);
        }
    }, [selectedTickets, queryClient, clearSelection]);
```

- [ ] **Step 4: Kumpulkan nomor ticket terpilih**

`filteredTickets` (baris 255) bertipe `Ticket[]` — `PaginatedResponse.data` di baris 79, dan `Ticket.ticketNumber` adalah `string` wajib (`hooks/useTickets.ts:7`). Karena itu **tidak** perlu anotasi `any` maupun fallback ke potongan id. Tambahkan di dekat `isAllSelected` (baris 368):

```tsx
    const selectedTicketNumbers = useMemo(
        () => filteredTickets
            .filter((t) => selectedTickets.has(t.id))
            .map((t) => t.ticketNumber),
        [filteredTickets, selectedTickets],
    );
```

- [ ] **Step 5: Sambungkan bar dan dialog**

Blok render di baris 738-744 saat ini:

```tsx
            {/* Bulk Actions Bar */}
            <BulkActionsBar
                selectedCount={selectedTickets.size}
                onAssign={handleBulkAssign}
                onChangeStatus={handleBulkStatusChange}
                onClear={clearSelection}
            />
```

Ganti menjadi:

```tsx
            {/* Bulk Actions Bar */}
            <BulkActionsBar
                selectedCount={selectedTickets.size}
                onAssign={handleBulkAssign}
                onChangeStatus={handleBulkStatusChange}
                onClear={clearSelection}
                onDelete={isAdmin ? () => setDeleteDialogOpen(true) : undefined}
            />

            <BulkDeleteDialog
                isOpen={deleteDialogOpen}
                ticketNumbers={selectedTicketNumbers}
                isLoading={isDeleting}
                onConfirm={handleBulkDelete}
                onCancel={() => setDeleteDialogOpen(false)}
            />
```

Tambahkan import tepat setelah baris 54 (`import { BulkActionsBar, SelectCheckbox } from '../components/BulkActionsBar';`):

```tsx
import { BulkDeleteDialog } from '../components/BulkDeleteDialog';
```

- [ ] **Step 6: Typecheck**

Run: `cd apps/frontend && npx tsc -p tsconfig.app.json --noEmit`
Expected: tidak ada error baru pada `BulkActionsBar.tsx` atau `BentoTicketListPage.tsx`.

- [ ] **Step 7: Verifikasi manual di browser**

Login sebagai ADMIN → buka daftar ticket → pilih 2 ticket → tombol Hapus muncul → klik → dialog menampilkan "Hapus 2 ticket?" dan nomornya → ketik `1` (tombol Hapus tetap disabled, tombol Batal tetap aktif) → ketik `2` (tombol Hapus aktif) → Hapus → ticket hilang dari daftar dan toast muncul.

Lalu login sebagai AGENT: pilih ticket → tombol Hapus **tidak muncul**.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/features/ticket-board/components/BulkActionsBar.tsx apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx
git commit -m "feat(ticket-board): add ADMIN bulk delete to ticket list"
```

---

## Task 10: Tombol Hapus di halaman Oracle K2

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx`

**Interfaces:**
- Consumes: `BulkDeleteDialog` (Task 8); endpoint `DELETE /tickets/bulk` (Task 4), dipanggil lewat `api.delete` langsung — sama seperti `handleBulkAssignSubmit` di baris 221.
- Produces: —

**Kenapa halaman ini butuh perubahan terpisah.** Halaman Oracle K2 **tidak** memakai `BulkActionsBar` bersama; ia mendefinisikan `BulkAssignBar` lokal di baris 540 dan merendernya di baris 493-499. Menyentuh bar bersama saja akan meninggalkan Oracle K2 tanpa fitur hapus — persis yang diminta di permintaan asli.

**Beda penting dari Task 9.** Halaman ini **tidak punya** variabel `isAdmin`; yang ada hanya `canEdit` (baris 248), yang juga mencakup AGENT dan MANAGER. Menggantung tombol Hapus pada `canEdit` akan menampilkannya ke non-ADMIN, jadi Step 3 memperkenalkan `isAdmin` baru di file ini.

- [ ] **Step 1: Tambah prop `onDelete` ke `BulkAssignBar` lokal**

Ubah signature di baris 540:

```tsx
const BulkAssignBar: React.FC<{
    selectedCount: number;
    onClear: () => void;
    onAssign: (id: string) => Promise<void>;
    onDelete?: () => void;
}> = ({ selectedCount, onClear, onAssign, onDelete }) => {
```

- [ ] **Step 2: Tambah `Trash2` ke import `lucide-react`**

Import berada di baris 4-18 dan berakhir dengan `UserCheck,` di baris 17. Ubah baris 17-18 dari:

```tsx
    UserCheck,
} from 'lucide-react';
```

menjadi:

```tsx
    UserCheck,
    Trash2,
} from 'lucide-react';
```

Catatan: baris 538 memuat `import { UserCheck as _UserCheck } from 'lucide-react'; void _UserCheck;` — import di tengah file yang tidak terpakai. Biarkan; membersihkannya di luar cakupan permintaan ini (CLAUDE.md §10 — refactor tak diminta = P3).

- [ ] **Step 3: Render tombol Hapus di bar**

Tombol Assign berakhir di baris 559 dan tombol Clear mulai di baris 560. Sisipkan di antara keduanya:

```tsx
            {onDelete && (
                <button
                    onClick={onDelete}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-lg text-red-300 hover:text-red-200 hover:bg-red-900/30"
                >
                    <Trash2 className="w-4 h-4" />
                    Hapus
                </button>
            )}
```

- [ ] **Step 4: Tambah state, `isAdmin`, dan daftar nomor ticket**

Halaman sudah punya `user` (baris 44), `selectedTickets` (baris 50), `clearSelection` (baris 214), `queryClient` (baris 42), `toast` (import baris 22), `api` (import baris 20), dan `rowData` bertipe `TicketRowData[]` (baris 117). `useState`/`useMemo`/`useCallback` semuanya sudah ada di import baris 1.

Tambahkan dua state tepat setelah `selectedTickets` di baris 50:

```tsx
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
```

Lalu tambahkan `isAdmin` dan `selectedTicketNumbers` tepat setelah `canEdit` di baris 248:

```tsx
    const isAdmin = user?.role === 'ADMIN';

    const selectedTicketNumbers = useMemo(
        () => rowData
            .filter((t) => selectedTickets.has(t.id))
            .map((t) => t.ticketNumber || t.id.slice(0, 8)),
        [rowData, selectedTickets],
    );
```

Fallback `|| t.id.slice(0, 8)` dipertahankan di sini — berbeda dengan Task 9 — karena `TicketRowData.ticketNumber` bertipe `string | undefined` (`components/TicketListRow.tsx:35`), bukan `string` wajib. Pola fallback ini menyalin `TicketListRow.tsx:166`.

- [ ] **Step 5: Tambah handler hapus**

Sisipkan tepat setelah `handleBulkAssignSubmit` (berakhir baris 229), meniru struktur handler tetangganya:

```tsx
    const handleBulkDelete = useCallback(async () => {
        const ticketIds = Array.from(selectedTickets);
        setIsDeleting(true);
        try {
            const res = await api.delete('/tickets/bulk', { data: { ticketIds } });
            const deleted = res.data?.deleted ?? ticketIds.length;
            const failed = res.data?.failed?.length ?? 0;
            toast.success(
                failed > 0
                    ? `${deleted} ticket dihapus, ${failed} gagal`
                    : `${deleted} ticket dihapus`,
            );
            queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
            clearSelection();
            setDeleteDialogOpen(false);
        } catch (error) {
            toast.error('Gagal menghapus ticket');
        } finally {
            setIsDeleting(false);
        }
    }, [selectedTickets, queryClient, clearSelection]);
```

- [ ] **Step 6: Sambungkan bar dan dialog**

Blok render di baris 492-499 saat ini:

```tsx
                {/* Bulk assign dialog (Oracle/K2 only allows AGENT_ORACLE + ADMIN as assignees) */}
                {canEdit && selectedTickets.size > 0 && (
                    <BulkAssignBar
                        selectedCount={selectedTickets.size}
                        onClear={clearSelection}
                        onAssign={handleBulkAssignSubmit}
                    />
                )}
```

Ganti menjadi:

```tsx
                {/* Bulk assign dialog (Oracle/K2 only allows AGENT_ORACLE + ADMIN as assignees) */}
                {canEdit && selectedTickets.size > 0 && (
                    <BulkAssignBar
                        selectedCount={selectedTickets.size}
                        onClear={clearSelection}
                        onAssign={handleBulkAssignSubmit}
                        onDelete={isAdmin ? () => setDeleteDialogOpen(true) : undefined}
                    />
                )}

                <BulkDeleteDialog
                    isOpen={deleteDialogOpen}
                    ticketNumbers={selectedTicketNumbers}
                    isLoading={isDeleting}
                    onConfirm={handleBulkDelete}
                    onCancel={() => setDeleteDialogOpen(false)}
                />
```

- [ ] **Step 7: Tambah import `BulkDeleteDialog`**

Tambahkan tepat setelah baris 36 (`import type { Agent, TicketRowData } from '../components/TicketListRow';`):

```tsx
import { BulkDeleteDialog } from '../components/BulkDeleteDialog';
```

- [ ] **Step 8: Typecheck**

Run: `cd apps/frontend && npx tsc -p tsconfig.app.json --noEmit`
Expected: tidak ada error baru pada `BentoOracleK2TicketsPage.tsx`.

- [ ] **Step 9: Verifikasi manual**

Login sebagai ADMIN → buka halaman Oracle K2 → pilih 2 request → tombol Hapus muncul → dialog menampilkan "Hapus 2 ticket?" dan nomornya → ketik `2` → Hapus → daftar ter-refresh dan toast muncul.

Login sebagai AGENT_ORACLE → pilih request → tombol Assign tetap ada, tombol Hapus **tidak muncul**.

- [ ] **Step 10: Commit**

```bash
git add apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx
git commit -m "feat(ticket-board): add ADMIN bulk delete to Oracle K2 page"
```

---

## Task 11: Verifikasi akhir end-to-end

**Files:** tidak ada perubahan kode — hanya verifikasi.

- [ ] **Step 1: Backend typecheck penuh**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error.

- [ ] **Step 2: Frontend typecheck penuh**

Run: `cd apps/frontend && npx tsc -p tsconfig.app.json --noEmit`
Expected: hanya 6 error praeksisting di `ClientTicketDetailPage.tsx` (properti `email`/`site` pada tipe `{ id, fullName }`) — berasal dari pekerjaan lain yang belum di-commit, di luar cakupan plan ini. Error di file lain adalah regresi; perbaiki sebelum lanjut.

- [ ] **Step 3: Jalankan suite ticketing satu per satu**

**Jangan digabung menjadi satu perintah.** Jalankan berurutan, tunggu tiap perintah selesai sebelum menjalankan berikutnya:

```bash
cd apps/backend
npx jest --runInBand src/modules/ticketing/services/ticket-soft-delete.spec.ts
npx jest --runInBand src/modules/ticketing/__tests__/ticket-soft-delete-metadata.spec.ts
npx jest --runInBand src/modules/ticketing/services/ticket-update.service.spec.ts
npx jest --runInBand src/modules/ticketing/services/ticket-query.site-isolation.spec.ts
npx jest --runInBand src/modules/ticketing/presentation/tickets.controller.spec.ts
npx jest --runInBand src/modules/ticketing/__tests__/ticket-authorization.spec.ts
npx jest --runInBand src/modules/ticketing/__tests__/cross-site-smoke.spec.ts
npx jest --runInBand src/modules/workload/workload.site-isolation.spec.ts
```

Expected: semua PASS.

- [ ] **Step 4: Verifikasi otorisasi lewat HTTP**

Dengan backend berjalan, uji penolakan peran secara langsung (ganti `<TOKEN>` dan `<ID>`):

```bash
# AGENT harus ditolak
curl -X DELETE http://localhost:3000/tickets/bulk \
  -H "Authorization: Bearer <TOKEN_AGENT>" \
  -H "Content-Type: application/json" \
  -d '{"ticketIds":["<ID>"]}'
```
Expected: `403 Forbidden`.

```bash
# Input tidak valid harus ditolak DTO
curl -X DELETE http://localhost:3000/tickets/bulk \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"ticketIds":["bukan-uuid"]}'
```
Expected: `400 Bad Request`.

- [ ] **Step 5: Verifikasi data benar-benar soft, bukan hard**

Setelah menghapus satu ticket lewat UI, konfirmasi barisnya masih ada:

```sql
SELECT id, "ticketNumber", "deletedAt" FROM tickets WHERE "deletedAt" IS NOT NULL LIMIT 5;
```
Expected: baris muncul dengan `deletedAt` terisi — bukan hilang.

Dan pesan turunannya tidak ikut terhapus:

```sql
SELECT COUNT(*) FROM ticket_messages WHERE "ticketId" = '<ID_YANG_DIHAPUS>';
```
Expected: jumlah tetap sama seperti sebelum penghapusan.

- [ ] **Step 6: Verifikasi jejak audit**

```sql
SELECT "userId", "action", "entityId", "oldValue" FROM audit_logs
WHERE "action" = 'DELETE_TICKET' ORDER BY "createdAt" DESC LIMIT 5;
```
Expected: satu baris per ticket yang dihapus, dengan `oldValue` memuat `ticketNumber`.

Nama tabel `audit_logs` dan `ticket_messages` sudah diverifikasi dari `@Entity('audit_logs')` (`audit-log.entity.ts:158`) dan `@Entity('ticket_messages')` (`ticket-message.entity.ts:13`).

- [ ] **Step 7: Commit akhir bila ada perbaikan**

```bash
git add -A
git commit -m "test(ticketing): verify admin bulk delete end-to-end"
```

---

## Catatan risiko yang dibawa dari spec

Tiga hal ini **bukan bug** — konsekuensi keputusan yang sudah disetujui. Jangan "perbaiki" tanpa bertanya:

1. **Tidak ada UI restore.** Salah hapus hanya pulih lewat query DB produksi: `UPDATE tickets SET "deletedAt" = NULL WHERE "ticketNumber" = '...';`. Dialog ketik-jumlah adalah satu-satunya pengaman sebelum aksi.
2. **Dua bar seleksi akan menyimpang.** Perubahan berikutnya pada perilaku hapus harus disalin ke dua tempat. Dialognya sudah dibagi (Task 8), barnya tidak.
3. **SQL mentah baru bisa lolos.** Tidak ada lint yang mencegah `entityManager.query('... FROM tickets ...')` baru ditulis tanpa `AND "deletedAt" IS NULL`. Mitigasi hanya code review.

---

## Di mana plan ini menyimpang dari spec

Dua penyimpangan sadar. Keduanya dicatat di sini agar reviewer tidak perlu menebak apakah ini kelalaian.

**1. Spec §5 uji #2 dan #3 tidak diimplementasikan.** Spec meminta `ticket-query.soft-delete.spec.ts` yang membuktikan ticket terhapus absen dari list/stats/pencarian (#2) dan dari hasil `leftJoinAndSelect` di `access-request`/`lost-item` (#3). Keduanya menuntut database sungguhan: keduanya menguji SQL yang **dibangkitkan TypeORM**, bukan logika kita. Suite ticketing yang ada seluruhnya memakai repository mock — memalsukan `QueryBuilder` di sini berarti menguji mock itu sendiri, yang akan lulus bahkan bila filter soft-delete tidak pernah aktif. Sebagai gantinya:

- **Task 6** mengunci prasyaratnya (`deletedAt` benar-benar terdaftar sebagai `deleteDate` di metadata) — satu-satunya bagian yang bisa diuji tanpa DB, dan justru bagian yang bisa rusak diam-diam bila `@DeleteDateColumn()` terhapus saat refactor.
- **Task 11 Step 5** memverifikasi hal yang sama terhadap DB sungguhan lewat SQL manual.

Yang hilang karena ini: perlindungan otomatis terhadap regresi saat upgrade TypeORM — persis alasan spec §5 mempertahankan uji #3. Bila suatu saat ada infrastruktur test DB di backend, uji #2 dan #3 layak ditambahkan dan tidak perlu brainstorming ulang.

**2. Spec §4.2 dan §7 menyatakan `ConfirmationDialog.tsx` tidak berubah — plan ini mengubahnya.** Klaim spec benar untuk *menampung* input jumlah (slot `children` sudah ada), tetapi tidak cukup untuk *mengunci* tombol Hapus sampai angkanya cocok: tombol konfirmasi hanya patuh pada `isLoading` (baris 142). Tanpa perubahan, pengaman ketik-jumlah menjadi hiasan — pengguna tetap bisa menekan Hapus tanpa mengetik apa pun, dan D4 gagal total. Task 8 karena itu menambah satu prop opsional `confirmDisabled?: boolean` (default `false`), sehingga tidak ada pemakai lama yang berubah perilakunya.
