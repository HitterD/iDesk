# Hardware Request — Bugfix & Role Flatten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix UUID/route conflict & missing endpoints di module hardware-request, dan ratakan 3-tier role ICT (LEAD/PROC/TECH) menjadi satu role `ICT_STAFF`.

**Architecture:** Surgical fix di module Nest (reorder controllers + tambah handler GET) + flatten role enum + selaraskan API path/query antara FE dan BE. No DB migration.

**Tech Stack:** NestJS 10, TypeORM, class-validator, React 18 + Vitest + React Query, Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-04-19-hardware-request-bugfix-and-role-flatten-design.md`.

---

## File Map

**Backend (modify):**
- `apps/backend/src/modules/hardware-request/hardware-request.module.ts` — controllers order
- `apps/backend/src/modules/hardware-request/dto/calendar-query.dto.ts` — rename param
- `apps/backend/src/modules/hardware-request/domain/enums/hardware-role.enum.ts` — add `ICT_STAFF`
- `apps/backend/src/modules/hardware-request/guards/hardware-role.guard.ts` — pickRole flatten
- `apps/backend/src/modules/hardware-request/presentation/hardware-request.controller.ts`
- `apps/backend/src/modules/hardware-request/presentation/installation.controller.ts` — add `unscheduled`, `my-today`
- `apps/backend/src/modules/hardware-request/presentation/hardware-catalog.controller.ts`
- `apps/backend/src/modules/hardware-request/presentation/hardware-comment.controller.ts`
- `apps/backend/src/modules/hardware-request/presentation/hardware-activity.controller.ts`
- `apps/backend/src/modules/hardware-request/presentation/hardware-dashboard.controller.ts`
- `apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts` — calendar param + new queries
- `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts`
- `apps/backend/src/modules/hardware-request/listeners/email-notifier.listener.ts`
- `apps/backend/src/modules/users/users.controller.ts` — `@Get('technicians')`
- `apps/backend/src/modules/users/users.service.ts` — `getTechnicians()`
- `apps/backend/src/modules/permissions/permissions.service.ts` — seed default presets

**Backend (test, modify):**
- `apps/backend/src/modules/hardware-request/mutual-scheduling.integration.spec.ts`
- `apps/backend/src/modules/hardware-request/listeners/email-notifier.listener.spec.ts`
- `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.spec.ts`
- `apps/backend/src/modules/hardware-request/realtime/__tests__/hardware-request.gateway.auth.spec.ts`
- `apps/backend/src/modules/hardware-request/presentation/__tests__/hardware-activity.rbac.spec.ts`

**Backend (test, create):**
- `apps/backend/src/modules/hardware-request/guards/__tests__/hardware-role.guard.spec.ts`
- `apps/backend/src/modules/hardware-request/presentation/__tests__/installation.controller.routes.spec.ts`
- `apps/backend/src/modules/users/__tests__/users.technicians.spec.ts`

**Frontend (modify):**
- `apps/frontend/src/features/hardware-request/types/index.ts`
- `apps/frontend/src/features/hardware-request/hooks/usePermissions.ts`
- `apps/frontend/src/features/hardware-request/utils/permission.util.ts`
- `apps/frontend/src/features/hardware-request/api/installation.api.ts`
- `apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx`
- `apps/frontend/src/features/hardware-request/components/calendar/InstallationCalendarPage.tsx` (status union usage)
- `apps/frontend/src/features/hardware-request/components/calendar/UnscheduledList.tsx` (kalau referensi role)
- `apps/frontend/src/features/hardware-request/components/installation/InstallationScheduler.tsx` (kalau referensi role)

**Frontend (test, modify):**
- `apps/frontend/src/features/hardware-request/utils/__tests__/permission.util.test.ts`

---

## Task 1: Reorder controllers di hardware-request module

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/hardware-request.module.ts`

- [ ] **Step 1: Tulis test gagal — calendar route reachable**

Create `apps/backend/src/modules/hardware-request/presentation/__tests__/installation.controller.routes.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { HardwareRequestModule } from '../../hardware-request.module';
// import test app harness/factories sesuai konvensi repo
// (ikuti pola spec backend lain seperti hardware-activity.rbac.spec.ts)

describe('InstallationController routes (route order)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        // bootstrap test app sesuai konvensi (mock JwtAuthGuard, role STAFF)
        // ...
    });

    afterAll(async () => { await app.close(); });

    it('GET /hardware-requests/calendar tidak match :id (no UUID 400)', async () => {
        const res = await request(app.getHttpServer())
            .get('/hardware-requests/calendar')
            .query({ from: '2026-04-19', to: '2026-04-26' });
        expect(res.status).not.toBe(400);
        expect(res.status).toBeLessThan(500);
    });

    it('GET /hardware-requests/unscheduled tidak match :id', async () => {
        const res = await request(app.getHttpServer()).get('/hardware-requests/unscheduled');
        expect(res.status).not.toBe(400);
        expect(res.status).toBeLessThan(500);
    });

    it('GET /hardware-requests/my-today tidak match :id', async () => {
        const res = await request(app.getHttpServer()).get('/hardware-requests/my-today');
        expect(res.status).not.toBe(400);
        expect(res.status).toBeLessThan(500);
    });
});
```

- [ ] **Step 2: Run test, lihat fail**

Run: `pnpm --filter backend test -- installation.controller.routes`
Expected: FAIL — calendar 400 / unscheduled 404 / my-today 404.

- [ ] **Step 3: Reorder controllers array**

Di `hardware-request.module.ts`, ganti urutan:

```ts
controllers: [
    InstallationController,
    HardwareCatalogController,
    HardwareDashboardController,
    HardwareCommentController,
    HardwareActivityController,
    HardwareRequestController,   // taruh paling akhir karena punya @Get(':id')
    IctBudgetRedirectController,
],
```

- [ ] **Step 4: Run test ulang**

Run: `pnpm --filter backend test -- installation.controller.routes`
Expected: calendar PASS (atau lolos ke handler), unscheduled & my-today masih 404 (handler belum ada — Task 7/8).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/hardware-request.module.ts \
        apps/backend/src/modules/hardware-request/presentation/__tests__/installation.controller.routes.spec.ts
git commit -m "fix(hardware-request): reorder controllers so static routes win over :id"
```

---

## Task 2: Rename CalendarQueryDto.technicianId → technicianIds

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/dto/calendar-query.dto.ts`
- Modify: `apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts`

- [ ] **Step 1: Tulis test gagal**

Append ke `installation.controller.routes.spec.ts`:

```ts
it('GET /calendar menerima technicianIds[] dan tidak abaikan filter', async () => {
    const tid = '11111111-1111-1111-1111-111111111111';
    const res = await request(app.getHttpServer())
        .get('/hardware-requests/calendar')
        .query({ from: '2026-04-19', to: '2026-04-26', technicianIds: [tid] });
    expect(res.status).toBeLessThan(500);
    // assertion bahwa service.calendar dipanggil dengan technicianIds: [tid]
    // (gunakan jest.spyOn pada InstallationScheduleService.calendar)
});
```

- [ ] **Step 2: Run test, lihat fail**

Run: `pnpm --filter backend test -- installation.controller.routes`
Expected: filter di-ignore atau spy menerima `undefined`.

- [ ] **Step 3: Update DTO**

```ts
import { IsDateString, IsOptional, IsUUID, IsArray, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { InstallStatus } from '../domain/enums/install-status.enum';

export class CalendarQueryDto {
    @IsDateString() from: string;
    @IsDateString() to: string;
    @IsOptional() @IsArray() @IsUUID('4', { each: true })
    @Type(() => String) technicianIds?: string[];
    @IsOptional() @IsArray() @IsEnum(InstallStatus, { each: true })
    status?: InstallStatus[];
}
```

- [ ] **Step 4: Update service consumer**

Di `installation-schedule.service.ts → calendar(q)`, ganti referensi `q.technicianId` → `q.technicianIds`. Cari semua occurrence:

```bash
grep -n "technicianId" apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts
```

Replace pemakaian filter di query builder.

- [ ] **Step 5: Run test ulang**

Run: `pnpm --filter backend test -- installation.controller.routes`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/hardware-request/dto/calendar-query.dto.ts \
        apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts \
        apps/backend/src/modules/hardware-request/presentation/__tests__/installation.controller.routes.spec.ts
git commit -m "fix(hardware-request): align CalendarQueryDto param to technicianIds[]"
```

---

## Task 3: Tambah ICT_STAFF enum + flatten guard pickRole

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/domain/enums/hardware-role.enum.ts`
- Modify: `apps/backend/src/modules/hardware-request/guards/hardware-role.guard.ts`
- Create: `apps/backend/src/modules/hardware-request/guards/__tests__/hardware-role.guard.spec.ts`

- [ ] **Step 1: Tulis test guard**

```ts
// hardware-role.guard.spec.ts
import { pickRole } from '../hardware-role.guard';
import { HardwareRole } from '../../domain/enums/hardware-role.enum';

describe('pickRole', () => {
    it.each([
        ['ADMIN'], ['MANAGER'], ['AGENT'], ['ICT_LEAD'], ['ICT_PROCUREMENT'],
        ['ICT_TECHNICIAN'], ['ICT_STAFF'], ['PROCUREMENT'], ['TECHNICIAN'],
        ['AGENT_OPERATIONAL_SUPPORT'], ['AGENT_ADMIN'],
    ])('maps %s -> ICT_STAFF', (r) => {
        expect(pickRole({ roles: [r] } as any)).toBe(HardwareRole.ICT_STAFF);
    });

    it('maps regular USER -> USER', () => {
        expect(pickRole({ roles: ['USER'] } as any)).toBe(HardwareRole.USER);
    });

    it('default unknown -> USER', () => {
        expect(pickRole({ roles: ['SOMETHING'] } as any)).toBe(HardwareRole.USER);
    });
});
```

> Catatan: jika `pickRole` saat ini bukan named export, ubah dulu jadi named export.

- [ ] **Step 2: Run test, fail**

Run: `pnpm --filter backend test -- hardware-role.guard`
Expected: FAIL (`ICT_STAFF` belum ada).

- [ ] **Step 3: Tambah enum value**

`hardware-role.enum.ts`:

```ts
export enum HardwareRole {
    USER = 'USER',
    ICT_STAFF = 'ICT_STAFF',
    // deprecated aliases — tetap export untuk backward-compat (test lama, listener lama)
    ICT_LEAD = 'ICT_STAFF' as any,
    ICT_PROCUREMENT = 'ICT_STAFF' as any,
    ICT_TECHNICIAN = 'ICT_STAFF' as any,
}
```

> Alternatif aman: hapus 3 deprecated jika sudah refactor semua call-site (Task 4). Sementara biarkan agar Task 4 inkremental.

- [ ] **Step 4: Update guard**

`hardware-role.guard.ts`:

```ts
export function pickRole(user: { roles?: string[] }): HardwareRole {
    const all = (user.roles ?? []).map((r) => r.toUpperCase());
    const ICT_TOKENS = new Set([
        'ADMIN', 'MANAGER', 'AGENT',
        'ICT_LEAD', 'ICT_MANAGER', 'ICT_PROCUREMENT', 'ICT_TECHNICIAN', 'ICT_STAFF',
        'PROCUREMENT', 'TECHNICIAN',
        'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ADMIN',
    ]);
    if (all.some((r) => ICT_TOKENS.has(r))) {
        return HardwareRole.ICT_STAFF;
    }
    return HardwareRole.USER;
}
```

- [ ] **Step 5: Run test, pass**

Run: `pnpm --filter backend test -- hardware-role.guard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/enums/hardware-role.enum.ts \
        apps/backend/src/modules/hardware-request/guards/hardware-role.guard.ts \
        apps/backend/src/modules/hardware-request/guards/__tests__/hardware-role.guard.spec.ts
git commit -m "feat(hardware-request): introduce ICT_STAFF and flatten pickRole"
```

---

## Task 4: Update @HardwareRoles di semua controller → ICT_STAFF

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/presentation/hardware-request.controller.ts`
- Modify: `apps/backend/src/modules/hardware-request/presentation/installation.controller.ts`
- Modify: `apps/backend/src/modules/hardware-request/presentation/hardware-catalog.controller.ts`
- Modify: `apps/backend/src/modules/hardware-request/presentation/hardware-comment.controller.ts`
- Modify: `apps/backend/src/modules/hardware-request/presentation/hardware-activity.controller.ts`
- Modify: `apps/backend/src/modules/hardware-request/presentation/hardware-dashboard.controller.ts`

- [ ] **Step 1: Cari semua call site**

Run:
```bash
grep -rn "HardwareRole\.\(ICT_LEAD\|ICT_PROCUREMENT\|ICT_TECHNICIAN\)" \
   apps/backend/src/modules/hardware-request/presentation/
```

- [ ] **Step 2: Replace ke ICT_STAFF**

Untuk setiap match, ganti dekorator:

```ts
// SEBELUM
@HardwareRoles(HardwareRole.ICT_LEAD)
@HardwareRoles(HardwareRole.ICT_PROCUREMENT)
@HardwareRoles(HardwareRole.ICT_TECHNICIAN)
@HardwareRoles(HardwareRole.ICT_LEAD, HardwareRole.ICT_PROCUREMENT, HardwareRole.ICT_TECHNICIAN)

// SESUDAH (semua jadi)
@HardwareRoles(HardwareRole.ICT_STAFF)
```

Endpoint USER-allowed (mis. `@HardwareRoles(HardwareRole.USER, HardwareRole.ICT_TECHNICIAN)` di `installation.controller.ts → propose/confirm/reschedule`) → `@HardwareRoles(HardwareRole.USER, HardwareRole.ICT_STAFF)`.

- [ ] **Step 3: Verifikasi compile**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Run subset existing tests**

Run: `pnpm --filter backend test -- hardware-request`
Expected: ada beberapa fail di test existing (Task 9 nanti).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/presentation/
git commit -m "refactor(hardware-request): collapse role decorators to ICT_STAFF"
```

---

## Task 5: Update services + listeners → ICT_STAFF

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts`
- Modify: `apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts`
- Modify: `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts`
- Modify: `apps/backend/src/modules/hardware-request/listeners/email-notifier.listener.ts`

- [ ] **Step 1: Audit semua role check internal**

Run:
```bash
grep -rn "ICT_LEAD\|ICT_PROCUREMENT\|ICT_TECHNICIAN" \
   apps/backend/src/modules/hardware-request/services/ \
   apps/backend/src/modules/hardware-request/listeners/
```

- [ ] **Step 2: Update service authorize() guards**

Di setiap service yang cek `role === HardwareRole.ICT_LEAD` dst, ganti jadi `role === HardwareRole.ICT_STAFF`. Untuk pengecekan kombinasi (mis. `role === LEAD || role === PROC`), gabung menjadi single `role === ICT_STAFF`.

Contoh perubahan di `hardware-request-command.service.ts`:

```ts
// SEBELUM
function authorizeApprove(actor: { role: HardwareRole }) {
    if (actor.role !== HardwareRole.ICT_LEAD) throw new PermissionDeniedError();
}

// SESUDAH
function authorizeApprove(actor: { role: HardwareRole }) {
    if (actor.role !== HardwareRole.ICT_STAFF) throw new PermissionDeniedError();
}
```

Lakukan pola yang sama untuk `authorizeProcurement`, `authorizeInstall`, dst.

- [ ] **Step 3: Update listeners — gabung 3 query menjadi 1**

`in-app-notifier.listener.ts`:

```ts
// SEBELUM
const leads = await this.perm.listUsersWithRole('ICT_LEAD');
const procs = await this.perm.listUsersWithRole('ICT_PROCUREMENT');
const techs = await this.perm.listUsersWithRole('ICT_TECHNICIAN');

// SESUDAH (helper baru — atau union manual)
const staff = await this.perm.listUsersWithRole('ICT_STAFF');
```

Tambah method helper di `PermissionsService.listUsersWithRole(role: 'ICT_STAFF')`: kembalikan distinct user yang memiliki role-DB ∈ {`ADMIN`,`MANAGER`,`AGENT`} **dan** `pageAccess.hardware_requests = true` (atau pakai SQL union jika lebih simple).

- [ ] **Step 4: Update email-notifier mirip**

```ts
// di onSubmitted/onApproved/onProcurementCompleted dst
const recipients = await this.perm.listUsersWithRole('ICT_STAFF');
await Promise.all(recipients.map((r) => this.mailer.sendMail({ to: r.email, ... })));
```

- [ ] **Step 5: Compile check**

Run: `pnpm --filter backend exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/ \
        apps/backend/src/modules/hardware-request/listeners/ \
        apps/backend/src/modules/permissions/permissions.service.ts
git commit -m "refactor(hardware-request): unify ICT_STAFF in services & notifiers"
```

---

## Task 6: PermissionsService.listUsersWithRole('ICT_STAFF')

**Files:**
- Modify: `apps/backend/src/modules/permissions/permissions.service.ts`

- [ ] **Step 1: Tulis test**

Tambah test (atau buat baru) `apps/backend/src/modules/permissions/__tests__/list-users-with-role.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { PermissionsService } from '../permissions.service';
// ... seed 3 user: ADMIN, AGENT, USER

describe('PermissionsService.listUsersWithRole', () => {
    it('returns ADMIN+MANAGER+AGENT for ICT_STAFF', async () => {
        const list = await svc.listUsersWithRole('ICT_STAFF');
        expect(list.length).toBeGreaterThanOrEqual(2);
        expect(list.every((u) => ['ADMIN','MANAGER','AGENT'].includes(u.role))).toBe(true);
    });
});
```

- [ ] **Step 2: Run test, fail**

Run: `pnpm --filter backend test -- list-users-with-role`
Expected: FAIL.

- [ ] **Step 3: Implement**

Di `permissions.service.ts`, di method `listUsersWithRole(role: string)`, tambah cabang khusus `ICT_STAFF`:

```ts
async listUsersWithRole(role: string): Promise<Array<{ id: string; email: string; fullName: string; role: string }>> {
    if (role === 'ICT_STAFF') {
        const users = await this.usersRepo.find({
            where: [{ role: 'ADMIN' }, { role: 'MANAGER' }, { role: 'AGENT' }],
            select: ['id', 'email', 'fullName', 'role'],
        });
        return users;
    }
    // ... legacy mapping for ICT_LEAD/ICT_PROCUREMENT/ICT_TECHNICIAN tetap (back-compat) — boleh redirect ke ICT_STAFF.
    if (['ICT_LEAD', 'ICT_PROCUREMENT', 'ICT_TECHNICIAN'].includes(role)) {
        return this.listUsersWithRole('ICT_STAFF');
    }
    // ... existing implementation untuk role lain
}
```

- [ ] **Step 4: Test pass**

Run: `pnpm --filter backend test -- list-users-with-role`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/permissions/permissions.service.ts \
        apps/backend/src/modules/permissions/__tests__/list-users-with-role.spec.ts
git commit -m "feat(permissions): add ICT_STAFF group resolver"
```

---

## Task 7: InstallationController @Get('unscheduled')

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/presentation/installation.controller.ts`
- Modify: `apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts`

- [ ] **Step 1: Test fail (sudah ada di Task 1, tapi tambahkan kontrak data)**

Append:

```ts
it('GET /unscheduled returns array {id, requestNumber, siteName}', async () => {
    const res = await request(app.getHttpServer()).get('/hardware-requests/unscheduled');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
        success: true,
        data: expect.any(Array),
    });
});
```

- [ ] **Step 2: Run, fail**

Run: `pnpm --filter backend test -- installation.controller.routes`
Expected: 404 atau 500.

- [ ] **Step 3: Implement service method**

Di `installation-schedule.service.ts`:

```ts
async unscheduled(): Promise<Array<{ id: string; requestNumber: string; siteName: string }>> {
    const qb = this.requestRepo.createQueryBuilder('hr')
        .leftJoin('hr.site', 'site')
        .leftJoin('installation_schedule', 'sch',
            "sch.request_id = hr.id AND sch.status IN ('PROPOSED','CONFIRMED','IN_PROGRESS')")
        .where('hr.status = :st', { st: 'INSTALLATION' })
        .andWhere('sch.id IS NULL')
        .select(['hr.id AS id', 'hr.request_number AS "requestNumber"', 'site.name AS "siteName"']);
    return qb.getRawMany();
}
```

> Catatan: nama relasi/kolom (`hr.site`, `request_number`, `site.name`) — verifikasi entity sebelum implementasi. Sesuaikan jika konvensi repo berbeda.

- [ ] **Step 4: Tambah handler**

Di `installation.controller.ts` (tambah sebelum handler `:id` semantic — tapi karena module sudah reorder, urutan dalam class kurang kritis; tetap taruh di atas):

```ts
@Get('unscheduled')
@HardwareRoles(HardwareRole.ICT_STAFF)
async unscheduled() {
    const data = await this.scheduleSvc.unscheduled();
    return { success: true, data };
}
```

- [ ] **Step 5: Test pass**

Run: `pnpm --filter backend test -- installation.controller.routes`
Expected: PASS untuk unscheduled.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/hardware-request/presentation/installation.controller.ts \
        apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts \
        apps/backend/src/modules/hardware-request/presentation/__tests__/installation.controller.routes.spec.ts
git commit -m "feat(hardware-request): add GET /hardware-requests/unscheduled"
```

---

## Task 8: InstallationController @Get('my-today')

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/presentation/installation.controller.ts`
- Modify: `apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts`

- [ ] **Step 1: Test fail**

```ts
it('GET /my-today returns array {id, requestId, requestNumber, siteName, scheduledAt}', async () => {
    const res = await request(app.getHttpServer())
        .get('/hardware-requests/my-today');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.any(Array));
});
```

- [ ] **Step 2: Run, fail**

Run: `pnpm --filter backend test -- installation.controller.routes`

- [ ] **Step 3: Implement service**

Di `installation-schedule.service.ts`:

```ts
async myToday(userId: string): Promise<Array<{
    id: string; requestId: string; requestNumber: string; siteName: string; scheduledAt: string;
}>> {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date();   end.setHours(23,59,59,999);
    const rows = await this.scheduleRepo.createQueryBuilder('sch')
        .leftJoin('sch.request', 'hr')
        .leftJoin('hr.site', 'site')
        .where('sch.technician_id = :uid', { uid: userId })
        .andWhere('sch.scheduled_start BETWEEN :s AND :e', { s: start, e: end })
        .andWhere("sch.status IN ('PROPOSED','CONFIRMED','IN_PROGRESS')")
        .select([
            'sch.id AS id',
            'hr.id AS "requestId"',
            'hr.request_number AS "requestNumber"',
            'site.name AS "siteName"',
            'sch.scheduled_start AS "scheduledAt"',
        ])
        .getRawMany();
    return rows;
}
```

- [ ] **Step 4: Handler**

```ts
@Get('my-today')
@HardwareRoles(HardwareRole.ICT_STAFF)
async myToday(@Req() r: any) {
    const data = await this.scheduleSvc.myToday(r.user.id);
    return { success: true, data };
}
```

- [ ] **Step 5: Test pass**

Run: `pnpm --filter backend test -- installation.controller.routes`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/hardware-request/presentation/installation.controller.ts \
        apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts \
        apps/backend/src/modules/hardware-request/presentation/__tests__/installation.controller.routes.spec.ts
git commit -m "feat(hardware-request): add GET /hardware-requests/my-today"
```

---

## Task 9: Refactor existing tests ke ICT_STAFF

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/mutual-scheduling.integration.spec.ts`
- Modify: `apps/backend/src/modules/hardware-request/listeners/email-notifier.listener.spec.ts`
- Modify: `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.spec.ts`
- Modify: `apps/backend/src/modules/hardware-request/realtime/__tests__/hardware-request.gateway.auth.spec.ts`
- Modify: `apps/backend/src/modules/hardware-request/presentation/__tests__/hardware-activity.rbac.spec.ts`

- [ ] **Step 1: Cari occurrence**

Run:
```bash
grep -rn "ICT_LEAD\|ICT_PROCUREMENT\|ICT_TECHNICIAN" apps/backend/src/modules/hardware-request --include="*.spec.ts"
```

- [ ] **Step 2: Replace string literals**

Untuk tiap occurrence di file `*.spec.ts`:

```ts
// SEBELUM
{ id: techId, role: 'ICT_TECHNICIAN' }

// SESUDAH
{ id: techId, role: 'ICT_STAFF' }
```

Untuk listener spec:

```ts
// SEBELUM
expect(perm.listUsersWithRole).toHaveBeenCalledWith('ICT_LEAD')

// SESUDAH
expect(perm.listUsersWithRole).toHaveBeenCalledWith('ICT_STAFF')
```

- [ ] **Step 3: Run semua test backend hardware-request**

Run: `pnpm --filter backend test -- hardware-request`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/hardware-request/
git commit -m "test(hardware-request): align existing specs to ICT_STAFF"
```

---

## Task 10: GET /users/technicians

**Files:**
- Modify: `apps/backend/src/modules/users/users.controller.ts`
- Modify: `apps/backend/src/modules/users/users.service.ts`
- Create: `apps/backend/src/modules/users/__tests__/users.technicians.spec.ts`

- [ ] **Step 1: Tulis test**

```ts
// users.technicians.spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { UsersModule } from '../users.module';
// ... bootstrap test app, seed user ADMIN/AGENT/USER

describe('GET /users/technicians', () => {
    let app: INestApplication;

    beforeAll(async () => { /* bootstrap */ });
    afterAll(async () => { await app.close(); });

    it('returns 200 dengan array {id, fullName}', async () => {
        const res = await request(app.getHttpServer()).get('/users/technicians');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
        const list = res.body.data ?? res.body;
        if (list.length > 0) {
            expect(list[0]).toEqual({
                id: expect.any(String),
                fullName: expect.any(String),
            });
        }
    });

    it('tidak return USER role', async () => {
        const res = await request(app.getHttpServer()).get('/users/technicians');
        const ids = (res.body.data ?? res.body).map((u: any) => u.id);
        // assertion: USER ID seedan tidak ada di list
    });
});
```

- [ ] **Step 2: Run, fail**

Run: `pnpm --filter backend test -- users.technicians`
Expected: FAIL — endpoint 404.

- [ ] **Step 3: Implement service**

Di `users.service.ts`, tambah method:

```ts
async getTechnicians(): Promise<Array<{ id: string; fullName: string }>> {
    const users = await this.permissionsService.listUsersWithRole('ICT_STAFF');
    return users.map((u) => ({ id: u.id, fullName: u.fullName }));
}
```

> Inject `PermissionsService` di constructor jika belum.

- [ ] **Step 4: Implement controller**

Di `users.controller.ts`, tambah handler **sebelum** `@Patch(':id')`:

```ts
@Get('technicians')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'List users assignable as ICT technician' })
async getTechnicians() {
    const data = await this.usersService.getTechnicians();
    return { success: true, data };
}
```

- [ ] **Step 5: Verifikasi route order**

Cek di `users.controller.ts` urutan dekorator:
- `@Get('me')`, `@Get('agents')`, `@Get('agents/stats')`, `@Get('approvers')`, `@Get('technicians')`, `@Get()`, `@Get('import-template')`, `@Get('export')` di atas `@Patch(':id')` etc. Semua static route harus sebelum yang dynamic `:id`.

- [ ] **Step 6: Test pass**

Run: `pnpm --filter backend test -- users.technicians`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/users/users.controller.ts \
        apps/backend/src/modules/users/users.service.ts \
        apps/backend/src/modules/users/__tests__/users.technicians.spec.ts
git commit -m "feat(users): add GET /users/technicians"
```

---

## Task 11: Permissions seed — pastikan default preset includes hardware_requests

**Files:**
- Modify: `apps/backend/src/modules/permissions/permissions.service.ts`

- [ ] **Step 1: Audit seed default presets**

Run:
```bash
grep -nE "Admin|Manager|Agent|hardware_requests|pageAccess" apps/backend/src/modules/permissions/permissions.service.ts | head -60
```

- [ ] **Step 2: Tulis test idempotensi seed**

`apps/backend/src/modules/permissions/__tests__/seed-default-presets.spec.ts`:

```ts
import { PermissionsService } from '../permissions.service';
// ... bootstrap with empty DB

describe('seedDefaultPresets', () => {
    it('default presets include hardware_requests=true', async () => {
        await svc.seedDefaultPresets();
        const presets = await svc.getAllPresets();
        const wanted = ['Admin', 'Manager', 'Agent'];
        for (const name of wanted) {
            const p = presets.find((x) => x.name === name);
            expect(p?.pageAccess?.hardware_requests).toBe(true);
        }
    });

    it('idempotent: second call tidak duplicate', async () => {
        await svc.seedDefaultPresets();
        await svc.seedDefaultPresets();
        const presets = await svc.getAllPresets();
        const adminCount = presets.filter((p) => p.name === 'Admin').length;
        expect(adminCount).toBe(1);
    });
});
```

- [ ] **Step 3: Run, lihat status**

Run: `pnpm --filter backend test -- seed-default-presets`
Expected: kemungkinan FAIL kalau preset belum punya `hardware_requests=true`.

- [ ] **Step 4: Update seed payload**

Di method `seedDefaultPresets()` array preset definitions, untuk Admin/Manager/Agent tambahkan/pastikan:

```ts
{
    name: 'Admin',
    isSystem: true,
    targetRole: 'ADMIN',
    pageAccess: {
        // ... existing keys
        hardware_requests: true,
    },
    // ... permissions
},
// idem untuk Manager dan Agent
```

Kalau preset existing perlu update saat seed (bukan create only), tambahkan branch:

```ts
if (exists.isSystem) {
    // patch pageAccess.hardware_requests jika belum true
    if (!exists.pageAccess?.hardware_requests) {
        exists.pageAccess = { ...(exists.pageAccess ?? {}), hardware_requests: true };
        await this.presetRepo.save(exists);
    }
}
```

- [ ] **Step 5: Test pass**

Run: `pnpm --filter backend test -- seed-default-presets`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/permissions/permissions.service.ts \
        apps/backend/src/modules/permissions/__tests__/seed-default-presets.spec.ts
git commit -m "fix(permissions): ensure default presets include hardware_requests"
```

---

## Task 12: Frontend — types HardwareRole flatten

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/types/index.ts`

- [ ] **Step 1: Replace union**

```ts
export type HardwareRole = 'USER' | 'ICT_STAFF';
```

- [ ] **Step 2: Compile check (akan ada error sementara di consumer — fix di task berikut)**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: error di `permission.util.ts`, `usePermissions.ts`, `ActionPanel.tsx`. Lanjut Task 13–15.

- [ ] **Step 3: Commit (WIP-style allowed karena type-only)**

```bash
git add apps/frontend/src/features/hardware-request/types/index.ts
git commit -m "refactor(hardware-request/fe): collapse HardwareRole union to ICT_STAFF"
```

---

## Task 13: Frontend — usePermissions

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/hooks/usePermissions.ts`

- [ ] **Step 1: Update mapping**

```ts
import { useAuth } from '@/hooks/useAuth';
import { HardwareRole } from '../types';

export function usePermissions(): {
    role: HardwareRole;
    isIctStaff: boolean;
    isUser: boolean;
} {
    const { user } = useAuth();
    const systemRole = (user?.role ?? '').toUpperCase();
    const ICT_TOKENS = new Set([
        'ADMIN','MANAGER','AGENT','ICT_LEAD','ICT_PROCUREMENT','ICT_TECHNICIAN',
        'ICT_STAFF','PROCUREMENT','TECHNICIAN','AGENT_OPERATIONAL_SUPPORT','AGENT_ADMIN',
    ]);
    const role: HardwareRole = ICT_TOKENS.has(systemRole) ? 'ICT_STAFF' : 'USER';
    return {
        role,
        isIctStaff: role === 'ICT_STAFF',
        isUser: role === 'USER',
    };
}
```

- [ ] **Step 2: Hapus referensi `isIctLead/isTechnician/isProcurement` di seluruh module**

Run: `grep -rn "isIctLead\|isTechnician\|isProcurement" apps/frontend/src/features/hardware-request/`
Replace each ke `isIctStaff`.

- [ ] **Step 3: Compile**

Run: `pnpm --filter frontend exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/hardware-request/hooks/usePermissions.ts \
        apps/frontend/src/features/hardware-request/components/
git commit -m "refactor(hardware-request/fe): usePermissions returns isIctStaff"
```

---

## Task 14: Frontend — permission.util.ts + tests

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/utils/permission.util.ts`
- Modify: `apps/frontend/src/features/hardware-request/utils/__tests__/permission.util.test.ts`

- [ ] **Step 1: Update test fixture**

```ts
// permission.util.test.ts (refactor)
import { computePermissions } from '../permission.util';

describe('computePermissions (ICT_STAFF flat)', () => {
    const staff = (id = 's1') => ({ id, role: 'ICT_STAFF' as const });
    const user = (id = 'u1') => ({ id, role: 'USER' as const });

    it('ICT_STAFF can review when SUBMITTED', () => {
        const p = computePermissions(staff(), { status: 'SUBMITTED' } as any);
        expect(p.canReview).toBe(true);
    });

    it('ICT_STAFF can approve when UNDER_REVIEW', () => {
        const p = computePermissions(staff(), { status: 'UNDER_REVIEW' } as any);
        expect(p.canApprove).toBe(true);
    });

    it('ICT_STAFF can complete install when IN_PROGRESS', () => {
        const p = computePermissions(staff(), {
            status: 'INSTALLATION',
            installation: { status: 'IN_PROGRESS' },
        } as any);
        expect(p.canCompleteInstall).toBe(true);
    });

    it('USER cannot approve', () => {
        const p = computePermissions(user(), { status: 'UNDER_REVIEW' } as any);
        expect(p.canApprove).toBe(false);
    });

    it('USER (requester) can cancel SUBMITTED own', () => {
        const p = computePermissions(user('owner'), {
            status: 'SUBMITTED', requesterId: 'owner',
        } as any);
        expect(p.canCancel).toBe(true);
    });
});
```

> Sesuaikan signature `computePermissions` ke yang ada di repo.

- [ ] **Step 2: Run test, fail**

Run: `pnpm --filter frontend test -- permission.util`

- [ ] **Step 3: Update permission.util.ts**

```ts
import { HardwareRole } from '../types';

export interface PermissionInput {
    status: string;
    requesterId?: string;
    installation?: { status?: string; proposedBy?: string };
}
export interface PermissionUser { id: string; role: HardwareRole; }

export function computePermissions(user: PermissionUser, r: PermissionInput) {
    const isStaff = user.role === 'ICT_STAFF';
    const mine    = r.requesterId === user.id;
    const sched   = r.installation;
    const inCal   = ['INSTALLATION','PROCUREMENT'].includes(r.status);

    return {
        canEdit:                isStaff === false && mine && r.status === 'DRAFT',
        canSubmit:              mine && r.status === 'DRAFT',
        canCancel:              mine && r.status === 'SUBMITTED',
        canReview:              isStaff && r.status === 'SUBMITTED',
        canApprove:             isStaff && r.status === 'UNDER_REVIEW',
        canReject:              isStaff && r.status === 'UNDER_REVIEW',
        canEditProcurement:     isStaff && (r.status === 'APPROVED' || r.status === 'PROCUREMENT'),
        canCompleteProcurement: isStaff && r.status === 'PROCUREMENT',
        canPropose:             inCal && (mine || isStaff) && (sched?.status === undefined || sched.status === 'RESCHEDULED' || sched.status === 'CANCELLED'),
        canConfirm:             inCal && sched?.status === 'PROPOSED' && (
                                    (isStaff && user.id !== sched.proposedBy) ||
                                    (mine    && user.id !== sched.proposedBy)
                                ),
        canReschedule:          inCal && (sched?.status === 'PROPOSED' || sched?.status === 'CONFIRMED') && (isStaff || mine),
        canStartInstall:        isStaff && sched?.status === 'CONFIRMED',
        canScanBarcode:         isStaff && sched?.status === 'IN_PROGRESS',
        canCompleteInstall:     isStaff && sched?.status === 'IN_PROGRESS',
        canManageCatalog:       isStaff,
    };
}
```

- [ ] **Step 4: Run test, pass**

Run: `pnpm --filter frontend test -- permission.util`

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/utils/
git commit -m "refactor(hardware-request/fe): permission.util uses ICT_STAFF flat"
```

---

## Task 15: Frontend — installation.api.ts align URL & status union

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/api/installation.api.ts`

- [ ] **Step 1: Update file**

```ts
import api from '../../../lib/api';

export type ReschedulePayload = {
    proposedAt: string;
    reason: string;
};

export type InstallStatus = 'PROPOSED' | 'CONFIRMED' | 'IN_PROGRESS' | 'DONE' | 'RESCHEDULED' | 'CANCELLED';

export type CalendarEventResponse = {
    scheduleId: string;
    requestId: string;
    requestNumber: string;
    siteName: string;
    technicianName: string;
    status: InstallStatus;
    scheduledAt: string;
    endsAt?: string | null;
};

export async function fetchCalendarEvents(params: { from: string; to: string; technicianIds?: string[] }) {
    const query = new URLSearchParams({ from: params.from, to: params.to });
    if (params.technicianIds?.length) {
        params.technicianIds.forEach((id) => query.append('technicianIds', id));
    }
    const { data } = await api.get<{ data: CalendarEventResponse[] }>(`/hardware-requests/calendar?${query}`);
    return data.data;
}

export async function rescheduleSchedule(requestId: string, payload: ReschedulePayload) {
    const { data } = await api.post(`/hardware-requests/${requestId}/schedule/reschedule`, payload);
    return data;
}

export async function fetchTechnicians() {
    const { data } = await api.get<{ data: { id: string; fullName: string }[] }>('/users/technicians');
    return data.data;
}

export async function fetchUnscheduledRequests() {
    const { data } = await api.get<{ data: { id: string; requestNumber: string; siteName: string }[] }>('/hardware-requests/unscheduled');
    return data.data;
}

export async function fetchMyTodaySchedules() {
    const { data } = await api.get<{
        data: { id: string; requestId: string; requestNumber: string; siteName: string; scheduledAt: string }[]
    }>('/hardware-requests/my-today');
    return data.data;
}

export async function completeInstallation(requestId: string, payload: { items: { itemId: string; assetCode: string }[] }) {
    const { data } = await api.post(`/hardware-requests/${requestId}/install/complete`, payload);
    return data;
}
```

- [ ] **Step 2: Update consumers**

Run: `grep -rn "rescheduleSchedule\|completeInstallation\|status: 'PENDING'\|status: 'SCHEDULED'\|status: 'INSTALLING'\|status: 'COMPLETED'" apps/frontend/src/features/hardware-request/`

Untuk setiap consumer:
- `rescheduleSchedule(scheduleId, ...)` → `rescheduleSchedule(requestId, ...)` (ubah callsite agar oper `requestId`).
- Status string literal `PENDING/SCHEDULED/INSTALLING/COMPLETED` → `PROPOSED/CONFIRMED/IN_PROGRESS/DONE`. Update label/util display jika ada.

- [ ] **Step 3: Compile**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/hardware-request/
git commit -m "fix(hardware-request/fe): align installation API paths and status union"
```

---

## Task 16: ActionPanel + komponen turunan

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx`
- Modify: komponen lain yang masih merefer role tier (cek via grep)

- [ ] **Step 1: Audit**

Run:
```bash
grep -rn "ICT_LEAD\|ICT_PROCUREMENT\|ICT_TECHNICIAN" apps/frontend/src/features/hardware-request/
```

- [ ] **Step 2: Replace pengecekan ke ICT_STAFF**

Untuk setiap kondisi:

```tsx
// SEBELUM
[r.status === 'INSTALLATION' && role === 'ICT_TECHNICIAN', <button>Complete Installation</button>]

// SESUDAH
[r.status === 'INSTALLATION' && role === 'ICT_STAFF', <button>Complete Installation</button>]
```

- [ ] **Step 3: Compile + run frontend tests**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/
git commit -m "refactor(hardware-request/fe): components use ICT_STAFF role"
```

---

## Task 17: Manual smoke verification

**Files:** —

- [ ] **Step 1: Start backend & frontend**

Run (split terminal):
```bash
pnpm --filter backend dev
pnpm --filter frontend dev
```

- [ ] **Step 2: Login sebagai user ADMIN**

Cek di browser: http://localhost:5173 → login.

- [ ] **Step 3: Buka calendar page**

Navigate ke `/hardware-requests/calendar`. Verifikasi:
- Tidak ada error 400 di console / network.
- Calendar render (kosong jika belum ada schedule).

- [ ] **Step 4: Cek API langsung**

Run di console browser atau Postman:
```
GET /v1/hardware-requests/calendar?from=2026-04-19&to=2026-04-26  → 200
GET /v1/hardware-requests/unscheduled                              → 200
GET /v1/hardware-requests/my-today                                 → 200
GET /v1/users/technicians                                          → 200
```

- [ ] **Step 5: Buka Manage Presets**

Navigate ke `/admin/agents`. Klik tombol "Manage Presets". Verifikasi:
- Dialog terbuka.
- 3 default preset (Admin/Manager/Agent) terlihat.
- Klik salah satu → `pageAccess.hardware_requests = true`.

- [ ] **Step 6: End-to-end role flatten**

Login sebagai user dengan role AGENT. Verifikasi bisa:
- Buka request detail.
- Action panel menampilkan tombol Approve / Procurement / Schedule / Complete sesuai status.
- Klik approve → request transition tanpa 403.

- [ ] **Step 7: Tandai checklist + commit log**

Catat hasil di komentar PR atau `docs/superpowers/changelog.md` (kalau ada).

---

## Task 18: Update spec lama dengan banner partial-supersede

**Files:**
- Modify: `docs/superpowers/specs/2026-04-17-hardware-request-rework-design.md`

- [ ] **Step 1: Tambah banner di awal**

Sisipkan setelah `**Status:** Approved (brainstorming phase)`:

```md
> **Partial supersede 2026-04-19:** Section "User Roles" 3-tier (ICT_LEAD / ICT_PROCUREMENT / ICT_TECHNICIAN) digantikan satu role `ICT_STAFF`. Lihat `2026-04-19-hardware-request-bugfix-and-role-flatten-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-17-hardware-request-rework-design.md
git commit -m "docs: mark partial supersede on hardware-request 3-tier role"
```

---

## Done Criteria

- [ ] Semua test backend & frontend hijau (`pnpm test` di kedua workspace).
- [ ] Manual smoke checklist Task 17 ✓.
- [ ] No `ICT_LEAD/ICT_PROCUREMENT/ICT_TECHNICIAN` di code aktif (kecuali alias deprecated di enum + back-compat branch di `permissions.service.listUsersWithRole`).
- [ ] Spec 2026-04-17 punya banner supersede.
