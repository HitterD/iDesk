# TV Board — Kanban Tiket per Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tampilkan kanban tiket read-only (Open/In Progress/Resolved) per site di layar TV besar, diakses via link token publik tanpa login, update real-time via Socket.IO.

**Architecture:** Kolom `tvToken` baru di `Site` entity (nullable, unique). Controller publik `TvBoardController` (`@Public()`) resolve token → siteId → data grouping. Gateway `TvBoardGateway` di namespace terpisah `/tv-board`, client join room `tv:{siteId}` pakai token (bukan JWT). `EventsGateway` existing dapat method baru `notifyTvBoard(siteId, event, payload)` dipanggil dari titik-titik yang sudah emit `notifyStatusChange`/`notifyNewTicket`/ticket-updated. Endpoint admin generate/revoke token nempel di `SitesController` existing. Frontend: route publik `/tv/:token`, halaman fullscreen 3-kolom, hook socket baru, tab baru di Settings admin.

**Tech Stack:** NestJS (TypeORM, Socket.IO, class-validator), React + Vite + Tailwind + socket.io-client, Jest (backend), Vitest (frontend).

## Global Constraints

- Tidak ada `UserRole` baru — TV Board bukan role, murni token publik.
- Tidak ada polling fallback — hanya Socket.IO auto-reconnect default.
- Tepat 3 kolom kanban (Open/In Progress/Resolved) — WAITING_VENDOR hanya badge count, TIDAK jadi kolom ke-4.
- Kartu tiket TIDAK menampilkan nomor tiket, TIDAK menampilkan kategori.
- Resolved kolom hanya tiket dengan `resolvedAt` = hari ini (server timezone, `process.env.TZ = 'UTC'` di `apps/backend/src/main.ts:44`, site punya `timezone` default `'Asia/Jakarta'` tapi filter pakai server date — cukup `DATE(resolvedAt) = CURRENT_DATE` di query, konsisten dengan pola existing).
- Generate token baru otomatis invalidate token lama (kolom sama di-overwrite).
- Route `/tv/:token` full di luar `ProtectedRoute`, tanpa nav/sidebar aplikasi utama.
- Semua field sudah ada di `Ticket` entity — tidak ada kolom baru di tabel `tickets`.

---

## File Structure

**Backend — baru:**
- `apps/backend/src/migrations/1784700000000-AddTvTokenToSite.ts` — migration tambah kolom `tvToken`.
- `apps/backend/src/modules/sites/dto/tv-token-response.dto.ts` — shape response generate/revoke (opsional, pakai inline type jika ringan).
- `apps/backend/src/modules/tv-board/tv-board.module.ts` — module baru.
- `apps/backend/src/modules/tv-board/tv-board.controller.ts` — `GET /tv/board/:token`, publik.
- `apps/backend/src/modules/tv-board/tv-board.service.ts` — resolve token, query & grouping tiket.
- `apps/backend/src/modules/tv-board/tv-board.gateway.ts` — namespace `/tv-board`.
- `apps/backend/src/modules/tv-board/tv-board.service.spec.ts` — unit test grouping + resolve token.
- `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts` — unit test room isolation.

**Backend — modifikasi:**
- `apps/backend/src/modules/sites/entities/site.entity.ts` — tambah kolom `tvToken`.
- `apps/backend/src/modules/sites/sites.service.ts` — tambah `generateTvToken(id, userId)`, `revokeTvToken(id, userId)`.
- `apps/backend/src/modules/sites/sites.controller.ts` — tambah `POST /sites/:id/tv-token`, `DELETE /sites/:id/tv-token`.
- `apps/backend/src/modules/audit/entities/audit-log.entity.ts` — tambah `AuditAction.SITE_TV_TOKEN_GENERATE`, `SITE_TV_TOKEN_REVOKE`.
- `apps/backend/src/modules/ticketing/presentation/gateways/events.gateway.ts` — tambah dependency opsional ke `TvBoardGateway` via `EventEmitter2` (hindari circular import module — lihat Task 5), pakai event emitter pattern yang sudah ada di codebase (`EventEmitter2`) bukan direct inject.
- `apps/backend/src/app.module.ts` — import `TvBoardModule`.

**Frontend — baru:**
- `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx` — halaman fullscreen kanban.
- `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts` — socket hook (model dari `useHealthSocket.ts`).
- `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx` — smoke test.
- `apps/frontend/src/features/settings/components/TvBoardSettings.tsx` — tab admin generate/copy/revoke per site.

**Frontend — modifikasi:**
- `apps/frontend/src/routes/AppRoutes.tsx` — tambah route publik `/tv/:token`.
- `apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx` — tambah tab "TV Board" di Administration section.

---

### Task 1: Migration — kolom `tvToken` di tabel `sites`

**Files:**
- Create: `apps/backend/src/migrations/1784700000000-AddTvTokenToSite.ts`
- Test: manual run via `npm run migration:run` / `migration:revert` (tidak ada spec file untuk migration, ikuti pola existing di codebase — tidak ada migration yang punya `.spec.ts`)

**Interfaces:**
- Produces: kolom `sites.tvToken` (varchar, nullable, unique) dipakai oleh Task 2 (`Site` entity) dan Task 3 (`SitesService`).

- [ ] **Step 1: Tulis migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTvTokenToSite1784700000000 implements MigrationInterface {
    public async up(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "tvToken" varchar UNIQUE`,
        );
    }

    public async down(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TABLE "sites" DROP COLUMN IF EXISTS "tvToken"`,
        );
    }
}
```

- [ ] **Step 2: Jalankan migration di DB dev**

Run: `cd apps/backend && npm run migration:run`
Expected: output mencantumkan `AddTvTokenToSite1784700000000` sebagai migration yang dijalankan, exit code 0.

- [ ] **Step 3: Verifikasi kolom ada**

Run: `cd apps/backend && npm run migration:show`
Expected: `AddTvTokenToSite1784700000000` muncul dengan tanda `[X]` (sudah dijalankan).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/migrations/1784700000000-AddTvTokenToSite.ts
git commit -m "feat(tv-board): add tvToken column migration for sites"
```

---

### Task 2: `Site` entity — tambah kolom `tvToken`

**Files:**
- Modify: `apps/backend/src/modules/sites/entities/site.entity.ts`

**Interfaces:**
- Consumes: migration dari Task 1 (kolom sudah ada di DB).
- Produces: `Site.tvToken: string | null` dipakai oleh `SitesService` (Task 3) dan `TvBoardService` (Task 5).

- [ ] **Step 1: Tambah kolom di entity**

Edit `apps/backend/src/modules/sites/entities/site.entity.ts`, tambahkan setelah `isServerHost` (baris 36):

```typescript
    @Column({ type: 'varchar', nullable: true, unique: true })
    tvToken: string | null;
```

- [ ] **Step 2: Verifikasi backend build tidak rusak**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: exit code 0, tidak ada error TypeScript.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/sites/entities/site.entity.ts
git commit -m "feat(tv-board): add tvToken field to Site entity"
```

---

### Task 3: `SitesService` + `SitesController` — generate/revoke TV token (Admin only)

**Files:**
- Modify: `apps/backend/src/modules/sites/sites.service.ts`
- Modify: `apps/backend/src/modules/sites/sites.controller.ts`
- Modify: `apps/backend/src/modules/audit/entities/audit-log.entity.ts`
- Test: `apps/backend/src/modules/sites/sites.service.spec.ts` (buat baru — belum ada spec untuk sites module)

**Interfaces:**
- Consumes: `Site.tvToken` dari Task 2, `AuditService.logAsync` (pola existing di `sites.service.ts:102-112`), `CacheService.getOrSet`/`delAsync` (pola existing).
- Produces: `SitesService.generateTvToken(id: string, userId?: string): Promise<Site>`, `SitesService.revokeTvToken(id: string, userId?: string): Promise<Site>` — dipakai controller Task 3, tidak dipakai task lain.

- [ ] **Step 1: Tambah 2 `AuditAction` baru**

Edit `apps/backend/src/modules/audit/entities/audit-log.entity.ts`, tambahkan di bawah `SITE_DELETE` (baris 111):

```typescript
    SITE_TV_TOKEN_GENERATE = 'SITE_TV_TOKEN_GENERATE',
    SITE_TV_TOKEN_REVOKE = 'SITE_TV_TOKEN_REVOKE',
```

- [ ] **Step 2: Tulis failing test untuk `generateTvToken`/`revokeTvToken`**

Create `apps/backend/src/modules/sites/sites.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SitesService } from './sites.service';
import { Site } from './entities/site.entity';
import { User } from '../users/entities/user.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { CacheService } from '../../shared/core/cache';

describe('SitesService — TV token', () => {
    let service: SitesService;
    let siteRepo: { findOne: jest.Mock; save: jest.Mock };
    let auditService: { logAsync: jest.Mock };
    let cacheService: { getOrSet: jest.Mock; delAsync: jest.Mock };

    beforeEach(async () => {
        siteRepo = {
            findOne: jest.fn(),
            save: jest.fn(async (site) => site),
        };
        auditService = { logAsync: jest.fn() };
        cacheService = {
            getOrSet: jest.fn(),
            delAsync: jest.fn().mockResolvedValue(undefined),
        };

        const module = await Test.createTestingModule({
            providers: [
                SitesService,
                { provide: getRepositoryToken(Site), useValue: siteRepo },
                { provide: getRepositoryToken(User), useValue: {} },
                { provide: getRepositoryToken(Ticket), useValue: {} },
                { provide: AuditService, useValue: auditService },
                { provide: CacheService, useValue: cacheService },
            ],
        }).compile();
        service = module.get(SitesService);
    });

    it('generates a new random token, overwriting any existing one', async () => {
        siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'SPJ', code: 'SPJ', tvToken: 'old-token' });

        const result = await service.generateTvToken('site-1', 'admin-1');

        expect(result.tvToken).toBeDefined();
        expect(result.tvToken).not.toBe('old-token');
        expect(auditService.logAsync).toHaveBeenCalledWith(expect.objectContaining({
            action: AuditAction.SITE_TV_TOKEN_GENERATE,
            entityId: 'site-1',
        }));
    });

    it('revokes token by setting it to null', async () => {
        siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'SPJ', code: 'SPJ', tvToken: 'active-token' });

        const result = await service.revokeTvToken('site-1', 'admin-1');

        expect(result.tvToken).toBeNull();
        expect(auditService.logAsync).toHaveBeenCalledWith(expect.objectContaining({
            action: AuditAction.SITE_TV_TOKEN_REVOKE,
            entityId: 'site-1',
        }));
    });

    it('throws NotFoundException when site does not exist', async () => {
        siteRepo.findOne.mockResolvedValue(null);

        await expect(service.generateTvToken('missing-id')).rejects.toThrow(NotFoundException);
    });
});
```

- [ ] **Step 3: Jalankan test, verifikasi gagal**

Run: `cd apps/backend && npx jest sites.service.spec.ts`
Expected: FAIL — `service.generateTvToken is not a function`.

- [ ] **Step 4: Implementasi `generateTvToken`/`revokeTvToken` di `SitesService`**

Edit `apps/backend/src/modules/sites/sites.service.ts`. Tambah import di atas (baris 1):

```typescript
import { randomBytes } from 'crypto';
```

Tambah 2 method baru setelah `remove()` (setelah baris 128):

```typescript
    async generateTvToken(id: string, userId?: string): Promise<Site> {
        const site = await this.findOne(id);
        const token = randomBytes(24).toString('hex');
        site.tvToken = token;
        const saved = await this.siteRepo.save(site);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.SITE_TV_TOKEN_GENERATE,
                entityType: 'Site',
                entityId: saved.id,
                description: `Generated TV board token for site: ${saved.name} (${saved.code})`,
            });
        }

        return saved;
    }

    async revokeTvToken(id: string, userId?: string): Promise<Site> {
        const site = await this.findOne(id);
        site.tvToken = null;
        const saved = await this.siteRepo.save(site);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.SITE_TV_TOKEN_REVOKE,
                entityType: 'Site',
                entityId: saved.id,
                description: `Revoked TV board token for site: ${saved.name} (${saved.code})`,
            });
        }

        return saved;
    }
```

- [ ] **Step 5: Jalankan test, verifikasi pass**

Run: `cd apps/backend && npx jest sites.service.spec.ts`
Expected: PASS — 3 test lulus.

- [ ] **Step 6: Tambah endpoint controller**

Edit `apps/backend/src/modules/sites/sites.controller.ts`, tambah setelah `remove()` (setelah baris 85, sebelum closing brace kelas):

```typescript
    @Post(':id/tv-token')
    @ApiOperation({ summary: 'Generate/regenerate TV board token for a site (invalidates old token)' })
    @Roles(UserRole.ADMIN)
    generateTvToken(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.sitesService.generateTvToken(id, req.user?.id || req.user?.userId);
    }

    @Delete(':id/tv-token')
    @ApiOperation({ summary: 'Revoke TV board token for a site' })
    @Roles(UserRole.ADMIN)
    revokeTvToken(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.sitesService.revokeTvToken(id, req.user?.id || req.user?.userId);
    }
```

- [ ] **Step 7: Verifikasi build**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/sites/sites.service.ts apps/backend/src/modules/sites/sites.controller.ts apps/backend/src/modules/sites/sites.service.spec.ts apps/backend/src/modules/audit/entities/audit-log.entity.ts
git commit -m "feat(tv-board): add generate/revoke TV token endpoints (admin only)"
```

---

### Task 4: `TvBoardModule` + `TvBoardService` — resolve token & group tickets

**Files:**
- Create: `apps/backend/src/modules/tv-board/tv-board.module.ts`
- Create: `apps/backend/src/modules/tv-board/tv-board.service.ts`
- Create: `apps/backend/src/modules/tv-board/tv-board.service.spec.ts`
- Modify: `apps/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `Site` entity (Task 2), `Ticket` entity (`apps/backend/src/modules/ticketing/entities/ticket.entity.ts` — fields `id, title, description, status, priority, user, assignedTo, slaTarget, isOverdue, siteId, resolvedAt, waitingVendorAt`).
- Produces:
  - `TvBoardService.resolveSiteIdByToken(token: string): Promise<string>` — throws `NotFoundException` jika token invalid/null. Dipakai Task 6 controller & Task 7 gateway.
  - `TvBoardService.getBoardData(siteId: string): Promise<TvBoardData>` dengan shape:
    ```typescript
    interface TvBoardCard {
        id: string;
        description: string;
        requesterName: string;
        assignedToName: string | null;
        priority: string;
        slaTarget: string | null;
        isOverdue: boolean;
    }
    interface TvBoardData {
        siteName: string;
        siteCode: string;
        open: TvBoardCard[];
        inProgress: TvBoardCard[];
        resolved: TvBoardCard[];
        waitingVendorCount: number;
    }
    ```
    Dipakai Task 6 controller & Task 7 gateway.

- [ ] **Step 1: Tulis failing test**

Create `apps/backend/src/modules/tv-board/tv-board.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TvBoardService } from './tv-board.service';
import { Site } from '../sites/entities/site.entity';
import { Ticket, TicketStatus, TicketPriority } from '../ticketing/entities/ticket.entity';

describe('TvBoardService', () => {
    let service: TvBoardService;
    let siteRepo: { findOne: jest.Mock };
    let ticketRepo: { find: jest.Mock; count: jest.Mock };

    beforeEach(async () => {
        siteRepo = { findOne: jest.fn() };
        ticketRepo = { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };

        const module = await Test.createTestingModule({
            providers: [
                TvBoardService,
                { provide: getRepositoryToken(Site), useValue: siteRepo },
                { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
            ],
        }).compile();
        service = module.get(TvBoardService);
    });

    describe('resolveSiteIdByToken', () => {
        it('returns siteId for a valid token', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', tvToken: 'valid-token' });
            const siteId = await service.resolveSiteIdByToken('valid-token');
            expect(siteId).toBe('site-1');
        });

        it('throws NotFoundException for unknown token', async () => {
            siteRepo.findOne.mockResolvedValue(null);
            await expect(service.resolveSiteIdByToken('bad-token')).rejects.toThrow(NotFoundException);
        });

        it('throws NotFoundException for empty token', async () => {
            await expect(service.resolveSiteIdByToken('')).rejects.toThrow(NotFoundException);
            expect(siteRepo.findOne).not.toHaveBeenCalled();
        });
    });

    describe('getBoardData', () => {
        it('groups tickets into open/inProgress/resolved columns and counts waiting vendor', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'Sampoerna Jaya', code: 'SPJ' });
            ticketRepo.find.mockResolvedValue([
                { id: 't1', status: TicketStatus.TODO, description: 'Printer rusak', user: { fullName: 'Budi' }, assignedTo: null, priority: TicketPriority.MEDIUM, slaTarget: null, isOverdue: false },
                { id: 't2', status: TicketStatus.IN_PROGRESS, description: 'Laptop lambat', user: { fullName: 'Ani' }, assignedTo: { fullName: 'Agen A' }, priority: TicketPriority.HIGH, slaTarget: new Date('2026-07-25'), isOverdue: true },
            ]);
            ticketRepo.count.mockResolvedValue(3);

            const data = await service.getBoardData('site-1');

            expect(data.siteCode).toBe('SPJ');
            expect(data.open).toHaveLength(1);
            expect(data.open[0]).toMatchObject({ description: 'Printer rusak', requesterName: 'Budi' });
            expect(data.inProgress).toHaveLength(1);
            expect(data.inProgress[0]).toMatchObject({ assignedToName: 'Agen A', isOverdue: true });
            expect(data.resolved).toHaveLength(0);
            expect(data.waitingVendorCount).toBe(3);
        });

        it('throws NotFoundException when site does not exist', async () => {
            siteRepo.findOne.mockResolvedValue(null);
            await expect(service.getBoardData('missing')).rejects.toThrow(NotFoundException);
        });
    });
});
```

- [ ] **Step 2: Jalankan test, verifikasi gagal**

Run: `cd apps/backend && npx jest tv-board.service.spec.ts`
Expected: FAIL — module `./tv-board.service` not found.

- [ ] **Step 3: Implementasi `TvBoardService`**

Create `apps/backend/src/modules/tv-board/tv-board.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Site } from '../sites/entities/site.entity';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';

export interface TvBoardCard {
    id: string;
    description: string;
    requesterName: string;
    assignedToName: string | null;
    priority: string;
    slaTarget: string | null;
    isOverdue: boolean;
}

export interface TvBoardData {
    siteName: string;
    siteCode: string;
    open: TvBoardCard[];
    inProgress: TvBoardCard[];
    resolved: TvBoardCard[];
    waitingVendorCount: number;
}

@Injectable()
export class TvBoardService {
    constructor(
        @InjectRepository(Site)
        private readonly siteRepo: Repository<Site>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
    ) { }

    async resolveSiteIdByToken(token: string): Promise<string> {
        if (!token) {
            throw new NotFoundException('TV board link tidak valid');
        }
        const site = await this.siteRepo.findOne({ where: { tvToken: token } });
        if (!site) {
            throw new NotFoundException('TV board link tidak valid');
        }
        return site.id;
    }

    async getBoardData(siteId: string): Promise<TvBoardData> {
        const site = await this.siteRepo.findOne({ where: { id: siteId } });
        if (!site) {
            throw new NotFoundException('Site not found');
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        const tickets = await this.ticketRepo.find({
            where: [
                { siteId, status: TicketStatus.TODO },
                { siteId, status: TicketStatus.IN_PROGRESS },
                { siteId, status: TicketStatus.RESOLVED, resolvedAt: Between(todayStart, tomorrowStart) },
            ],
            relations: ['user', 'assignedTo'],
            order: { createdAt: 'ASC' },
        });

        const waitingVendorCount = await this.ticketRepo.count({
            where: { siteId, status: TicketStatus.WAITING_VENDOR },
        });

        const toCard = (t: Ticket): TvBoardCard => ({
            id: t.id,
            description: t.description,
            requesterName: t.user?.fullName ?? 'Unknown',
            assignedToName: t.assignedTo?.fullName ?? null,
            priority: t.priority,
            slaTarget: t.slaTarget ? t.slaTarget.toISOString() : null,
            isOverdue: t.isOverdue,
        });

        return {
            siteName: site.name,
            siteCode: site.code,
            open: tickets.filter((t) => t.status === TicketStatus.TODO).map(toCard),
            inProgress: tickets.filter((t) => t.status === TicketStatus.IN_PROGRESS).map(toCard),
            resolved: tickets.filter((t) => t.status === TicketStatus.RESOLVED).map(toCard),
            waitingVendorCount,
        };
    }
}
```

- [ ] **Step 4: Jalankan test, verifikasi pass**

Run: `cd apps/backend && npx jest tv-board.service.spec.ts`
Expected: PASS — 5 test lulus.

- [ ] **Step 5: Buat `TvBoardModule`**

Create `apps/backend/src/modules/tv-board/tv-board.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from '../sites/entities/site.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { TvBoardService } from './tv-board.service';

@Module({
    imports: [TypeOrmModule.forFeature([Site, Ticket])],
    providers: [TvBoardService],
    exports: [TvBoardService],
})
export class TvBoardModule { }
```

(Controller & Gateway ditambahkan di Task 6 & 7 lewat edit langsung ke file ini — module ini akan di-edit lagi.)

- [ ] **Step 6: Daftarkan module di `app.module.ts`**

Edit `apps/backend/src/app.module.ts`. Tambah import setelah baris 74 (`import { SitesModule } ...`):

```typescript
import { TvBoardModule } from './modules/tv-board/tv-board.module';
```

Tambah ke array `imports` setelah `SitesModule` (baris 208):

```typescript
        TvBoardModule,
```

- [ ] **Step 7: Verifikasi backend boot tidak error**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/tv-board/ apps/backend/src/app.module.ts
git commit -m "feat(tv-board): add TvBoardService with token resolve and ticket grouping"
```

---

### Task 5: `EventsGateway` — emit event untuk TV board via `EventEmitter2`

**Konteks:** `TicketingModule` dan `TvBoardModule` tidak boleh saling import langsung (circular risk — `TvBoardModule` juga akan butuh gateway sendiri di Task 7, tapi gateway itu independen). Untuk menyalurkan event dari ticket lifecycle (create/status-change/update) ke `TvBoardGateway`, pakai `EventEmitter2` yang sudah jadi dependency existing di `TicketCreateService`/`TicketUpdateService` (lihat `apps/backend/src/modules/ticketing/services/ticket-create.service.ts:4` dan `ticket-update.service.ts:4`) — bukan direct inject cross-module.

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-create.service.ts`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-update.service.ts`

**Interfaces:**
- Produces: event `tv-board.ticket-changed` dengan payload `{ siteId: string }` di-emit lewat `EventEmitter2.emit()`. Dikonsumsi oleh `TvBoardGateway` (Task 7) via `@OnEvent('tv-board.ticket-changed')`.

- [ ] **Step 1: Emit event di `TicketCreateService` setelah ticket baru dibuat**

Baca dulu context sekitar baris 157 di `apps/backend/src/modules/ticketing/services/ticket-create.service.ts`:

```typescript
            this.eventsGateway.notifyNewTicket({
```

Tambahkan baris setelah pemanggilan `notifyNewTicket(...)` selesai (di baris setelah blok tersebut, sebelum method berikutnya), emit event tambahan:

```typescript
            if (savedTicket.siteId) {
                this.eventEmitter.emit('tv-board.ticket-changed', { siteId: savedTicket.siteId });
            }
```

(`this.eventEmitter` sudah tersedia sebagai constructor dependency di baris 35 file tersebut — tidak perlu import baru.)

- [ ] **Step 2: Emit event di `TicketUpdateService` pada `postUpdateActions`**

Edit `apps/backend/src/modules/ticketing/services/ticket-update.service.ts`, di method `postUpdateActions` (baris 176-230), tambah setelah baris 191 (`this.eventsGateway.notifyTicketListUpdate();`):

```typescript
        if (savedTicket.siteId) {
            this.eventEmitter.emit('tv-board.ticket-changed', { siteId: savedTicket.siteId });
        }
```

- [ ] **Step 3: Emit event juga di `assignTicket` (baris 232-346) dan `cancelTicket` (baris 348+)**

Di `assignTicket`, setelah baris 317 (`this.eventsGateway.notifyTicketListUpdate();`):

```typescript
        if (savedTicket.siteId) {
            this.eventEmitter.emit('tv-board.ticket-changed', { siteId: savedTicket.siteId });
        }
```

Di `cancelTicket`, cari baris `this.eventsGateway.notifyStatusChange(ticketId, TicketStatus.CANCELLED, user.fullName);` (baris 385), tambah setelahnya:

```typescript
        if (savedTicket.siteId) {
            this.eventEmitter.emit('tv-board.ticket-changed', { siteId: savedTicket.siteId });
        }
```

- [ ] **Step 4: Verifikasi build**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 5: Jalankan test existing ticket services, pastikan tidak regresi**

Run: `cd apps/backend && npx jest ticket-create ticket-update`
Expected: semua test PASS (tidak ada assertion baru dibutuhkan di sini — event emit tidak mengubah behavior existing, di-cover test integrasi Task 7).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-create.service.ts apps/backend/src/modules/ticketing/services/ticket-update.service.ts
git commit -m "feat(tv-board): emit tv-board.ticket-changed event on ticket lifecycle"
```

---

### Task 6: `TvBoardController` — endpoint publik `GET /tv/board/:token`

**Files:**
- Create: `apps/backend/src/modules/tv-board/tv-board.controller.ts`
- Modify: `apps/backend/src/modules/tv-board/tv-board.module.ts`

**Interfaces:**
- Consumes: `TvBoardService.resolveSiteIdByToken` dan `TvBoardService.getBoardData` (Task 4).
- Produces: route publik `GET /v1/tv/board/:token` (versioning otomatis via `main.ts` URI prefix) — dikonsumsi frontend Task 9.

- [ ] **Step 1: Buat controller**

Create `apps/backend/src/modules/tv-board/tv-board.controller.ts`:

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../shared/core/decorators/public.decorator';
import { TvBoardService } from './tv-board.service';

@ApiTags('TV Board')
@Controller('tv')
export class TvBoardController {
    constructor(private readonly tvBoardService: TvBoardService) { }

    @Public()
    @Get('board/:token')
    @ApiOperation({ summary: 'Get kanban board data for a site by TV token (public, no auth)' })
    async getBoard(@Param('token') token: string) {
        const siteId = await this.tvBoardService.resolveSiteIdByToken(token);
        return this.tvBoardService.getBoardData(siteId);
    }
}
```

- [ ] **Step 2: Daftarkan controller di module**

Edit `apps/backend/src/modules/tv-board/tv-board.module.ts`, tambah import dan daftarkan:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from '../sites/entities/site.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { TvBoardService } from './tv-board.service';
import { TvBoardController } from './tv-board.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Site, Ticket])],
    controllers: [TvBoardController],
    providers: [TvBoardService],
    exports: [TvBoardService],
})
export class TvBoardModule { }
```

- [ ] **Step 3: Verifikasi build**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/tv-board/tv-board.controller.ts apps/backend/src/modules/tv-board/tv-board.module.ts
git commit -m "feat(tv-board): add public GET /tv/board/:token endpoint"
```

---

### Task 7: `TvBoardGateway` — namespace `/tv-board`, room per site, real-time push

**Files:**
- Create: `apps/backend/src/modules/tv-board/tv-board.gateway.ts`
- Create: `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts`
- Modify: `apps/backend/src/modules/tv-board/tv-board.module.ts`

**Interfaces:**
- Consumes: `TvBoardService.resolveSiteIdByToken` (Task 4), event `tv-board.ticket-changed` dari `EventEmitter2` (Task 5).
- Produces: client-facing socket event `tv-board:update` dengan payload `TvBoardData` (di-refetch server-side dan di-emit ulang) — dikonsumsi `useTvBoardSocket` (Task 8).

Pola diambil dari `apps/backend/src/modules/health/health.gateway.ts` (namespace terisolasi) — bedanya di sini client identify pakai `token` field, bukan otomatis subscribe semua.

- [ ] **Step 1: Tulis failing test — room isolation**

Create `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts`:

```typescript
import { NotFoundException } from '@nestjs/common';
import { TvBoardGateway } from './tv-board.gateway';
import { TvBoardService } from './tv-board.service';

describe('TvBoardGateway', () => {
    let gateway: TvBoardGateway;
    let tvBoardService: { resolveSiteIdByToken: jest.Mock; getBoardData: jest.Mock };
    let mockServer: { to: jest.Mock; emit: jest.Mock };
    let toReturn: { emit: jest.Mock };

    beforeEach(() => {
        toReturn = { emit: jest.fn() };
        mockServer = { to: jest.fn().mockReturnValue(toReturn), emit: jest.fn() };
        tvBoardService = {
            resolveSiteIdByToken: jest.fn(),
            getBoardData: jest.fn().mockResolvedValue({ siteCode: 'SPJ', open: [], inProgress: [], resolved: [], waitingVendorCount: 0 }),
        };
        gateway = new TvBoardGateway(tvBoardService as any);
        (gateway as any).server = mockServer;
    });

    it('joins the tv:{siteId} room for a valid token and does not leak to other sites', async () => {
        tvBoardService.resolveSiteIdByToken.mockResolvedValue('site-A');
        const join = jest.fn();
        const emit = jest.fn();
        const client = { id: 'sock-1', join, emit, disconnect: jest.fn() } as any;

        await gateway.handleJoin(client, { token: 'token-A' });

        expect(join).toHaveBeenCalledWith('tv:site-A');
        expect(join).not.toHaveBeenCalledWith('tv:site-B');
    });

    it('disconnects the client for an invalid token', async () => {
        tvBoardService.resolveSiteIdByToken.mockRejectedValue(new NotFoundException('invalid'));
        const disconnect = jest.fn();
        const client = { id: 'sock-2', join: jest.fn(), emit: jest.fn(), disconnect } as any;

        await gateway.handleJoin(client, { token: 'bad-token' });

        expect(disconnect).toHaveBeenCalled();
    });

    it('only emits to the room of the site whose ticket changed', async () => {
        await gateway.handleTicketChanged({ siteId: 'site-A' });

        expect(mockServer.to).toHaveBeenCalledWith('tv:site-A');
        expect(mockServer.to).not.toHaveBeenCalledWith('tv:site-B');
        expect(toReturn.emit).toHaveBeenCalledWith('tv-board:update', expect.objectContaining({ siteCode: 'SPJ' }));
    });
});
```

- [ ] **Step 2: Jalankan test, verifikasi gagal**

Run: `cd apps/backend && npx jest tv-board.gateway.spec.ts`
Expected: FAIL — module `./tv-board.gateway` not found.

- [ ] **Step 3: Implementasi `TvBoardGateway`**

Create `apps/backend/src/modules/tv-board/tv-board.gateway.ts`:

```typescript
import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { TvBoardService } from './tv-board.service';

@WebSocketGateway({
    namespace: '/tv-board',
    cors: {
        origin: ['http://localhost:4050', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5050'],
        credentials: true,
    },
})
export class TvBoardGateway {
    @WebSocketServer() server: Server;
    private logger = new Logger('TvBoardGateway');
    private socketSiteMap: Map<string, string> = new Map();

    constructor(private readonly tvBoardService: TvBoardService) { }

    @SubscribeMessage('tv-board:join')
    async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { token: string }): Promise<void> {
        try {
            const siteId = await this.tvBoardService.resolveSiteIdByToken(data?.token);
            client.join(`tv:${siteId}`);
            this.socketSiteMap.set(client.id, siteId);
            this.logger.log(`TV client ${client.id} joined tv:${siteId}`);

            const boardData = await this.tvBoardService.getBoardData(siteId);
            client.emit('tv-board:update', boardData);
        } catch (error) {
            this.logger.warn(`TV client ${client.id} rejected: invalid token`);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket): void {
        this.socketSiteMap.delete(client.id);
    }

    @OnEvent('tv-board.ticket-changed')
    async handleTicketChanged(payload: { siteId: string }): Promise<void> {
        const boardData = await this.tvBoardService.getBoardData(payload.siteId);
        this.server.to(`tv:${payload.siteId}`).emit('tv-board:update', boardData);
    }
}
```

- [ ] **Step 4: Jalankan test, verifikasi pass**

Run: `cd apps/backend && npx jest tv-board.gateway.spec.ts`
Expected: PASS — 3 test lulus.

- [ ] **Step 5: Daftarkan gateway di module, pastikan `EventEmitterModule` tersedia**

Cek apakah `EventEmitterModule` sudah global — grep `EventEmitterModule.forRoot` di `app.module.ts`. Karena `TicketCreateService`/`TicketUpdateService` sudah pakai `EventEmitter2` tanpa import modul tambahan di `TicketingModule`, `EventEmitterModule` sudah terdaftar global di `app.module.ts`. Tidak perlu import ulang di `TvBoardModule`.

Edit `apps/backend/src/modules/tv-board/tv-board.module.ts` final:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from '../sites/entities/site.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { TvBoardService } from './tv-board.service';
import { TvBoardController } from './tv-board.controller';
import { TvBoardGateway } from './tv-board.gateway';

@Module({
    imports: [TypeOrmModule.forFeature([Site, Ticket])],
    controllers: [TvBoardController],
    providers: [TvBoardService, TvBoardGateway],
    exports: [TvBoardService],
})
export class TvBoardModule { }
```

- [ ] **Step 6: Verifikasi build & full backend test suite tidak regresi**

Run: `cd apps/backend && npx tsc --noEmit && npx jest tv-board`
Expected: exit code 0, semua test tv-board PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/tv-board/tv-board.gateway.ts apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts apps/backend/src/modules/tv-board/tv-board.module.ts
git commit -m "feat(tv-board): add TvBoardGateway with per-site room isolation"
```

---

### Task 8: Frontend — `useTvBoardSocket` hook

**Files:**
- Create: `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts`

**Interfaces:**
- Consumes: socket namespace `/tv-board`, events `tv-board:join` (emit), `tv-board:update` (listen) dari Task 7.
- Produces: `useTvBoardSocket(token: string)` returning `{ boardData: TvBoardData | null, isConnected: boolean }` — dipakai `BentoTvBoardPage` (Task 9).

- [ ] **Step 1: Implementasi hook**

Create `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface TvBoardCard {
    id: string;
    description: string;
    requesterName: string;
    assignedToName: string | null;
    priority: string;
    slaTarget: string | null;
    isOverdue: boolean;
}

export interface TvBoardData {
    siteName: string;
    siteCode: string;
    open: TvBoardCard[];
    inProgress: TvBoardCard[];
    resolved: TvBoardCard[];
    waitingVendorCount: number;
}

interface UseTvBoardSocketReturn {
    boardData: TvBoardData | null;
    isConnected: boolean;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:5050';

export function useTvBoardSocket(token: string | undefined): UseTvBoardSocketReturn {
    const [boardData, setBoardData] = useState<TvBoardData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!token) return;

        const socket = io(`${SOCKET_URL}/tv-board`, {
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('tv-board:join', { token });
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('tv-board:update', (data: TvBoardData) => {
            setBoardData(data);
        });

        socketRef.current = socket;

        return () => {
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
        };
    }, [token]);

    return { boardData, isConnected };
}
```

- [ ] **Step 2: Verifikasi TypeScript build**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/public/hooks/useTvBoardSocket.ts
git commit -m "feat(tv-board): add useTvBoardSocket hook"
```

---

### Task 9: Frontend — `BentoTvBoardPage` (fullscreen kanban)

**Files:**
- Create: `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx`
- Create: `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx`
- Modify: `apps/frontend/src/routes/AppRoutes.tsx`

**Interfaces:**
- Consumes: `useTvBoardSocket` (Task 8), `api` dari `apps/frontend/src/lib/api.ts` (initial fetch `GET /tv/board/:token`), `PRIORITY_CONFIG`/`STATUS_CONFIG` dari `apps/frontend/src/lib/constants/ticket.constants.ts`.
- Produces: komponen `BentoTvBoardPage` di-route sebagai `/tv/:token`.

- [ ] **Step 1: Tulis failing smoke test**

Create `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import { BentoTvBoardPage } from '../BentoTvBoardPage';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({
            data: {
                siteName: 'Sampoerna Jaya',
                siteCode: 'SPJ',
                open: [
                    { id: 't1', description: 'Printer rusak', requesterName: 'Budi', assignedToName: null, priority: 'MEDIUM', slaTarget: null, isOverdue: false },
                    { id: 't2', description: 'Server down', requesterName: 'Cici', assignedToName: 'Agen B', priority: 'CRITICAL', slaTarget: '2026-07-25T00:00:00.000Z', isOverdue: true },
                ],
                inProgress: [],
                resolved: [],
                waitingVendorCount: 2,
            },
        })),
    },
}));

vi.mock('../../hooks/useTvBoardSocket', () => ({
    useTvBoardSocket: () => ({ boardData: null, isConnected: true }),
}));

describe('BentoTvBoardPage', () => {
    it('renders site name, 3 columns, and waiting vendor badge from initial fetch', async () => {
        render(
            <MemoryRouter initialEntries={['/tv/abc-token']}>
                <Routes>
                    <Route path="/tv/:token" element={<BentoTvBoardPage />} />
                </Routes>
            </MemoryRouter>
        );

        expect(await screen.findByText('Sampoerna Jaya')).toBeInTheDocument();
        expect(screen.getByText(/Open/)).toBeInTheDocument();
        expect(screen.getByText(/In Progress/)).toBeInTheDocument();
        expect(screen.getByText(/Resolved/)).toBeInTheDocument();
        expect(screen.getByText(/Waiting Vendor: 2/)).toBeInTheDocument();
        expect(await screen.findByText('Printer rusak')).toBeInTheDocument();
    });

    it('shows overdue indicator (red border) on overdue card but not on normal card', async () => {
        render(
            <MemoryRouter initialEntries={['/tv/abc-token']}>
                <Routes>
                    <Route path="/tv/:token" element={<BentoTvBoardPage />} />
                </Routes>
            </MemoryRouter>
        );

        const overdueCard = (await screen.findByText('Server down')).closest('div[data-testid="tv-board-card"]');
        const normalCard = (await screen.findByText('Printer rusak')).closest('div[data-testid="tv-board-card"]');
        expect(overdueCard?.className).toContain('border-red-600');
        expect(normalCard?.className).not.toContain('border-red-600');
    });

    it('shows error page for invalid token', async () => {
        const api = (await import('@/lib/api')).default;
        (api.get as any).mockRejectedValueOnce({ response: { status: 404 } });

        render(
            <MemoryRouter initialEntries={['/tv/bad-token']}>
                <Routes>
                    <Route path="/tv/:token" element={<BentoTvBoardPage />} />
                </Routes>
            </MemoryRouter>
        );

        expect(await screen.findByText(/Link tidak valid/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Jalankan test, verifikasi gagal**

Run: `cd apps/frontend && npx vitest run BentoTvBoardPage.smoke.test.tsx`
Expected: FAIL — module `../BentoTvBoardPage` not found.

- [ ] **Step 3: Implementasi `BentoTvBoardPage`**

Create `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import api from '@/lib/api';
import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { useTvBoardSocket, type TvBoardCard, type TvBoardData } from '../hooks/useTvBoardSocket';

const COLUMNS: Array<{ key: 'open' | 'inProgress' | 'resolved'; title: string }> = [
    { key: 'open', title: 'Open' },
    { key: 'inProgress', title: 'In Progress' },
    { key: 'resolved', title: 'Resolved' },
];

function TvBoardCardView({ card }: { card: TvBoardCard }) {
    const priorityConfig = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.MEDIUM;
    return (
        <div
            data-testid="tv-board-card"
            className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border-l-4 p-4 mb-3 ${priorityConfig.barColor} ${card.isOverdue ? 'border-2 border-red-600' : ''}`}
        >
            <p className="font-semibold text-slate-800 dark:text-white line-clamp-2">{card.description}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{card.requesterName}</p>
            <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-slate-600 dark:text-slate-300">→ {card.assignedToName ?? 'Unassigned'}</span>
                {card.slaTarget && (
                    <span className="text-slate-400 flex items-center gap-1">
                        {card.isOverdue && <Clock className="w-3.5 h-3.5 text-red-500" />}
                        Target: {new Date(card.slaTarget).toLocaleDateString('id-ID')}
                    </span>
                )}
            </div>
        </div>
    );
}

export const BentoTvBoardPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [initialData, setInitialData] = useState<TvBoardData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());
    const { boardData: liveData } = useTvBoardSocket(token);

    useEffect(() => {
        if (!token) {
            setError('Link tidak valid, hubungi admin.');
            return;
        }
        api.get(`/tv/board/${token}`)
            .then((res) => setInitialData(res.data))
            .catch(() => setError('Link tidak valid, hubungi admin.'));
    }, [token]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const data = liveData ?? initialData;

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <p className="text-2xl text-slate-300">{error}</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <p className="text-xl text-slate-400">Memuat...</p>
            </div>
        );
    }

    const columnData: Record<'open' | 'inProgress' | 'resolved', TvBoardCard[]> = {
        open: data.open,
        inProgress: data.inProgress,
        resolved: data.resolved,
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
            <header className="flex items-center justify-between px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{data.siteName}</h1>
                <span className="text-2xl font-mono text-slate-600 dark:text-slate-300">
                    {now.toLocaleTimeString('id-ID')}
                </span>
                <span className="px-4 py-2 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-semibold">
                    Waiting Vendor: {data.waitingVendorCount}
                </span>
            </header>

            <div className="flex-1 grid grid-cols-3 gap-4 p-6 overflow-hidden">
                {COLUMNS.map((col) => (
                    <div key={col.key} className="flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                            {col.title} ({columnData[col.key].length})
                        </div>
                        <div className="flex-1 overflow-y-auto p-3">
                            {columnData[col.key].map((card) => (
                                <TvBoardCardView key={card.id} card={card} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
```

- [ ] **Step 4: Jalankan test, verifikasi pass**

Run: `cd apps/frontend && npx vitest run BentoTvBoardPage.smoke.test.tsx`
Expected: PASS — 2 test lulus.

- [ ] **Step 5: Tambah route publik**

Edit `apps/frontend/src/routes/AppRoutes.tsx`. Tambah lazy import setelah baris 44 (`const BentoFeedbackPage = lazy(...)`):

```typescript
const BentoTvBoardPage = lazy(() => import('../features/public/pages/BentoTvBoardPage').then(m => ({ default: m.BentoTvBoardPage })));
```

Tambah route setelah baris 164 (`<Route path="/feedback/:token" ... />`):

```typescript
            <Route path="/tv/:token" element={<Suspense fallback={<PageLoader />}><BentoTvBoardPage /></Suspense>} />
```

- [ ] **Step 6: Verifikasi build**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx apps/frontend/src/routes/AppRoutes.tsx
git commit -m "feat(tv-board): add public TV board kanban page and route"
```

---

### Task 10: Frontend — Settings admin tab generate/copy/revoke TV token

**Files:**
- Create: `apps/frontend/src/features/settings/components/TvBoardSettings.tsx`
- Modify: `apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx`

**Interfaces:**
- Consumes: `GET /sites` (existing, dipakai `SiteSelector.tsx`), `POST /sites/:id/tv-token`, `DELETE /sites/:id/tv-token` (Task 3).
- Produces: tab UI baru, tidak dikonsumsi task lain.

- [ ] **Step 1: Implementasi `TvBoardSettings`**

Create `apps/frontend/src/features/settings/components/TvBoardSettings.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Copy, RefreshCw, Trash2, Tv } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Site {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    tvToken: string | null;
}

export function TvBoardSettings() {
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const fetchSites = async () => {
        setLoading(true);
        try {
            const res = await api.get('/sites');
            setSites(Array.isArray(res.data) ? res.data : []);
        } catch {
            toast.error('Gagal memuat daftar site');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSites();
    }, []);

    const boardUrl = (token: string) => `${window.location.origin}/tv/${token}`;

    const handleGenerate = async (siteId: string) => {
        setBusyId(siteId);
        try {
            const res = await api.post(`/sites/${siteId}/tv-token`);
            setSites((prev) => prev.map((s) => (s.id === siteId ? { ...s, tvToken: res.data.tvToken } : s)));
            toast.success('Token TV board berhasil dibuat');
        } catch {
            toast.error('Gagal membuat token');
        } finally {
            setBusyId(null);
        }
    };

    const handleRevoke = async (siteId: string) => {
        setBusyId(siteId);
        try {
            await api.delete(`/sites/${siteId}/tv-token`);
            setSites((prev) => prev.map((s) => (s.id === siteId ? { ...s, tvToken: null } : s)));
            toast.success('Token TV board dicabut');
        } catch {
            toast.error('Gagal mencabut token');
        } finally {
            setBusyId(null);
        }
    };

    const handleCopy = (token: string) => {
        navigator.clipboard.writeText(boardUrl(token));
        toast.success('Link disalin ke clipboard');
    };

    if (loading) {
        return <p className="text-slate-400">Memuat...</p>;
    }

    return (
        <div className="space-y-4 max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                <Tv className="w-6 h-6" /> TV Board
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                Generate link kanban tiket per site untuk ditayangkan di layar TV. Generate ulang akan otomatis membatalkan link lama.
            </p>
            {sites.map((site) => (
                <div key={site.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
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
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Tambah tab di `BentoSettingsPage`**

Edit `apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx`. Baris 3 sudah import `Video` untuk tab Zoom Settings (baris 77: `{ value: 'zoom', icon: Video, label: 'Zoom Settings' }`) — jangan reuse, pakai ikon baru `MonitorPlay` supaya tidak ambigu di sidebar. Tambah ke import di baris 3:

```typescript
import { User, Lock, Palette, Moon, Sun, MessageCircle, Bell, Clock, CalendarClock, Loader2, HardDrive, Shield, Video, Volume2, MonitorPlay } from 'lucide-react';
```

Tambah lazy import setelah baris 17 (`const SoundSettingsTab = lazy(...)`):

```typescript
const TvBoardSettingsTab = lazy(() => import('../components/TvBoardSettings').then(m => ({ default: m.TvBoardSettings })));
```

Tambah entry di array Administration (baris 71-78), setelah `{ value: 'zoom', ... }`:

```typescript
                                        { value: 'tv-board', icon: MonitorPlay, label: 'TV Board' },
```

Tambah `Tabs.Content` setelah blok `zoom` (setelah baris 254, sebelum `</div>` penutup):

```typescript
                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="tv-board" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Suspense fallback={
                                    <div className="flex items-center justify-center h-64">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            <p className="text-sm text-slate-400">Memuat...</p>
                                        </div>
                                    </div>
                                }>
                                    <TvBoardSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}
```

- [ ] **Step 3: Verifikasi build**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/settings/components/TvBoardSettings.tsx apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx
git commit -m "feat(tv-board): add admin TV Board settings tab (generate/copy/revoke)"
```

---

### Task 11: Full regression check

**Files:** tidak ada file baru — verifikasi akhir.

- [ ] **Step 1: Backend full test suite**

Run: `cd apps/backend && npm test`
Expected: exit code 0, semua test PASS termasuk `tv-board.service.spec.ts`, `tv-board.gateway.spec.ts`, `sites.service.spec.ts`.

- [ ] **Step 2: Backend typecheck**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Frontend full test suite**

Run: `cd apps/frontend && npm test`
Expected: exit code 0, semua test PASS termasuk `BentoTvBoardPage.smoke.test.tsx`.

- [ ] **Step 4: Frontend typecheck**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 5: Commit (jika ada fix minor dari regression check)**

```bash
git add -A
git commit -m "fix(tv-board): resolve issues found during regression check"
```

(Skip step ini jika tidak ada perubahan.)
