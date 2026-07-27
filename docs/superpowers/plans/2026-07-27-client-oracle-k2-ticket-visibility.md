# Client Oracle/K2 Ticket Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tampilkan semua tiket Oracle/K2 milik client di My Tickets tanpa membuka tiket tersebut pada general list agent/admin, serta kunci perilaku TV Board dengan regression test.

**Architecture:** Perubahan hanya di backend query. `TicketQueryService.findAllPaginated` mempertahankan Oracle/K2 exclusion untuk setiap role non-`USER`, tetapi tidak menambah exclusion itu untuk `USER` yang sudah dibatasi `ticket.userId`. My Tickets tetap memakai endpoint dan pagination yang sama. TV Board tidak perlu perubahan produksi; test mengunci pemetaan card Oracle/K2 dan event refresh setelah create.

**Tech Stack:** NestJS 11, TypeORM 0.3, Jest 29, React 18, Vite.

## Global Constraints

- Oracle/K2 terdeteksi dengan `ticket.ticketType = 'ORACLE_REQUEST' OR ticket.category = 'ORACLE_REQUEST'`.
- `USER` hanya dapat melihat tiket dengan `ticket.userId = :userId`.
- `ADMIN`, `MANAGER`, `AGENT`, `AGENT_OPERATIONAL_SUPPORT`, `AGENT_ADMIN`, dan `AGENT_ORACLE` tidak melihat Oracle/K2 melalui `GET /tickets/paginated`.
- `GET /tickets/paginated/oracle` tetap menjadi queue Oracle/K2 khusus `ADMIN` dan `AGENT_ORACLE`.
- Jangan tambah endpoint, parameter query, dependency, frontend merge, atau perubahan layout TV Board.
- TV Board hanya memuat `TODO` dan `IN_PROGRESS`; Oracle/K2 tampil dengan `isOracleRequest: true`.

---

## File Structure

- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts` — menerapkan filter Oracle/K2 khusus berdasarkan role di general paginated query.
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts` — mengunci akses list role client dan non-client.
- Modify: `apps/backend/src/modules/ticketing/__tests__/ticket-create.oracle-guard.spec.ts` — mengunci event TV Board saat client membuat Oracle/K2 ticket pada site.
- Verify only: `apps/backend/src/modules/tv-board/tv-board.service.spec.ts` — coverage existing memastikan mapping card Oracle/K2 di TV Board.
- Verify only: `apps/frontend/src/features/client/pages/BentoMyTicketsPage.tsx` — tidak diubah; endpoint tetap `GET /tickets/paginated`.

### Task 1: Izinkan Oracle/K2 Milik Client di Query Paginated

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts:127-143`
- Test: `apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts`

**Interfaces:**
- Consumes: `findAllPaginated(userId: string, role: UserRole, userSiteId: string | null, options)`.
- Produces: `GET /tickets/paginated` untuk `USER` memuat semua tipe tiket milik caller; general list non-`USER` mengecualikan Oracle/K2.

- [ ] **Step 1: Tambahkan test gagal untuk query USER**

Tambahkan constants dan test berikut di `ticket-query.service.spec.ts`:

```typescript
const ORACLE_EXCLUSION =
    '(ticket.ticketType != :oracleType AND ticket.category != :oracleCategory)';
const ORACLE_FILTER_PARAMS = {
    oracleType: 'ORACLE_REQUEST',
    oracleCategory: 'ORACLE_REQUEST',
};

it('includes Oracle/K2 tickets owned by USER in the paginated list', async () => {
    await service.findAllPaginated('user-1', UserRole.USER, 'site-1');

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'ticket.userId = :userId',
        { userId: 'user-1' },
    );
    expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        ORACLE_EXCLUSION,
        ORACLE_FILTER_PARAMS,
    );
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
npm --prefix apps/backend test -- ticket-query.service.spec.ts
```

Expected: FAIL. Implementasi saat ini selalu menambahkan `ORACLE_EXCLUSION` sebelum branch role.

- [ ] **Step 3: Tambahkan test perlindungan non-USER**

Tambahkan test berikut:

```typescript
it.each([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.AGENT,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ADMIN,
    UserRole.AGENT_ORACLE,
])('keeps Oracle/K2 out of the general paginated list for %s', async (role) => {
    await service.findAllPaginated('actor-1', role, 'site-1');

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        ORACLE_EXCLUSION,
        ORACLE_FILTER_PARAMS,
    );
});
```

- [ ] **Step 4: Ubah filter Oracle/K2 minimum**

Di `ticket-query.service.ts`, ganti block filter Oracle/K2 sebelum role filtering dengan:

```typescript
// Client My Tickets must include every ticket owned by the requester.
// Oracle/K2 remains isolated from every non-client general list.
if (role !== UserRole.USER) {
    qb.andWhere(
        '(ticket.ticketType != :oracleType AND ticket.category != :oracleCategory)',
        ORACLE_FILTER_PARAMS,
    );
}
```

Hapus branch `ticketType === 'ORACLE_REQUEST' || category === 'ORACLE_REQUEST'` pada general endpoint. Endpoint `findAllPaginatedOracle` tetap satu-satunya query Oracle queue dan sudah memiliki filter Oracle-only sendiri.

- [ ] **Step 5: Jalankan test target sampai lulus**

Run:

```bash
npm --prefix apps/backend test -- ticket-query.service.spec.ts
```

Expected: PASS. USER tetap punya `ticket.userId` dan site filter; semua role non-USER punya Oracle exclusion.

- [ ] **Step 6: Review diff untuk batas akses**

Run:

```bash
git diff --check && git diff -- apps/backend/src/modules/ticketing/services/ticket-query.service.ts apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts
```

Expected: tidak ada whitespace error; tidak ada parameter client baru atau perubahan pada `findAllPaginatedOracle`.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-query.service.ts apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts
git commit -m "fix(tickets): show client Oracle requests in my tickets"
```

### Task 2: Kunci Refresh dan Card Oracle/K2 di TV Board

**Files:**
- Modify: `apps/backend/src/modules/ticketing/__tests__/ticket-create.oracle-guard.spec.ts`
- Verify: `apps/backend/src/modules/tv-board/tv-board.service.spec.ts`
- Production files unchanged: `apps/backend/src/modules/ticketing/services/ticket-create.service.ts`, `apps/backend/src/modules/tv-board/tv-board.service.ts`

**Interfaces:**
- Consumes: `TicketCreateService.createTicket(userId, createTicketDto, files?)` and `EventEmitter2.emit(eventName, payload)`.
- Produces: create Oracle/K2 ticket with `siteId` emits `tv-board.ticket-changed` with `{ siteId }`; board cards preserve `isOracleRequest: true`.

- [ ] **Step 1: Refactor test fixture to expose event emitter and site-bound client**

Di `ticket-create.oracle-guard.spec.ts`, deklarasikan di scope suite:

```typescript
let eventEmitter: { emit: jest.Mock };
```

Di `userRepo.findOne`, tambahkan user berikut sebelum fallback:

```typescript
if (id === 'user-site-1') {
    return {
        id: 'user-site-1',
        role: UserRole.USER,
        fullName: 'Site Client',
        siteId: 'site-1',
    };
}
```

Ganti argumen event emitter pada constructor dari `{ emit: jest.fn() } as any` menjadi:

```typescript
eventEmitter = { emit: jest.fn() };
```

Lalu pass `eventEmitter as any` sebagai argumen kedelapan `TicketCreateService`.

- [ ] **Step 2: Tambahkan regression test event TV Board**

Tambahkan test berikut setelah test USER existing:

```typescript
it('emits a TV Board refresh for an Oracle/K2 ticket created by a client with a site', async () => {
    await service.createTicket('user-site-1', {
        title: 'Oracle access issue',
        description: 'Tidak dapat membuka menu K2',
        category: 'ORACLE_REQUEST',
        ticketType: 'ORACLE_REQUEST',
    } as any);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
        'tv-board.ticket-changed',
        { siteId: 'site-1' },
    );
});
```

- [ ] **Step 3: Jalankan test create event**

Run:

```bash
npm --prefix apps/backend test -- ticket-create.oracle-guard.spec.ts
```

Expected: PASS tanpa perubahan produksi. `TicketCreateService` sudah emit event pada `ticket.siteId`; test baru mencegah regresi.

- [ ] **Step 4: Jalankan regression test TV Board**

Run:

```bash
npm --prefix apps/backend test -- tv-board.service.spec.ts
```

Expected: PASS. Test `groups tickets into open/inProgress columns and counts waiting vendor` membuktikan Oracle ticketType/category dipetakan ke card `isOracleRequest: true` pada kolom `TODO` dan `IN_PROGRESS`.

- [ ] **Step 5: Commit test regression**

```bash
git add apps/backend/src/modules/ticketing/__tests__/ticket-create.oracle-guard.spec.ts
git commit -m "test(tv-board): cover Oracle ticket create refresh"
```

### Task 3: Verifikasi Integrasi dan Build

**Files:**
- Verify only: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts`
- Verify only: `apps/backend/src/modules/ticketing/services/ticket-query.service.spec.ts`
- Verify only: `apps/backend/src/modules/ticketing/__tests__/ticket-create.oracle-guard.spec.ts`
- Verify only: `apps/backend/src/modules/tv-board/tv-board.service.spec.ts`
- Verify only: `apps/frontend/src/features/client/pages/BentoMyTicketsPage.tsx`

**Interfaces:**
- Consumes: backend Jest suites and frontend build scripts.
- Produces: verified role-aware My Tickets response with unchanged frontend contract and TV Board regression coverage.

- [ ] **Step 1: Jalankan seluruh test backend**

Run:

```bash
npm --prefix apps/backend test -- --runInBand
```

Expected: PASS. Bila suite gagal pada test tidak terkait, catat nama test dan error exact; jangan ubah test/produksi di luar scope untuk memaksa lulus.

- [ ] **Step 2: Build frontend tanpa mengubahnya**

Run:

```bash
npm --prefix apps/frontend run build
```

Expected: PASS. `BentoMyTicketsPage` tetap memanggil `GET /tickets/paginated` tanpa parameter Oracle khusus.

- [ ] **Step 3: Inspeksi status akhir**

Run:

```bash
git status --short && git log --oneline -2
```

Expected: dua commit scope perubahan terlihat dan tidak ada file produksi/frontend tak terkait yang ikut staged.

- [ ] **Step 4: Manual smoke check**

1. Login sebagai client pada site ber-TV token valid.
2. Buat ticket dengan `category=ORACLE_REQUEST` dan `ticketType=ORACLE_REQUEST`.
3. Buka My Tickets; ticket baru tampil dengan kategori Oracle/K2.
4. Login sebagai Oracle agent atau admin; buka `/tickets/oracle-k2`; ticket tampil.
5. Buka general ticket list sebagai admin dan agent operasional; ticket tidak tampil.
6. Buka TV Board site sama; saat `TODO`, ticket tampil di Open dengan badge `ORACLE / K2`; ubah menjadi `IN_PROGRESS` dan pastikan pindah ke kolom In Progress.

Expected: visibility dan status board sesuai spec; tidak ada request frontend dengan flag akses Oracle.

## Self-Review

- Spec coverage: Task 1 mencakup My Tickets dan isolasi role backend; Task 2 mencakup event refresh serta mapping TV Board; Task 3 mencakup suite, build, dan smoke flow.
- Placeholder scan: tidak ada `TBD`, `TODO`, atau langkah tanpa command/code untuk perubahan.
- Type consistency: seluruh task memakai `TicketQueryService.findAllPaginated`, `TicketCreateService.createTicket`, `EventEmitter2.emit`, `UserRole`, dan `isOracleRequest` yang sudah ada.
