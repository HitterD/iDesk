# Admin Delete Tickets & Oracle K2 Request

**Date:** 2026-08-21
**Branch:** `feat/email-notification-config`
**Status:** Design — menunggu implementation plan (`superpowers:writing-plans`)
**Permintaan asli:** "buatkan akses untuk sisi admin, bisa delete tickets dan oracle k2 request"

---

## 0. Keputusan terkunci

Daftar ini **mengikat** — hasil grilling, jangan dinegosiasi ulang tanpa persetujuan eksplisit.

| # | Keputusan | Nilai |
|---|-----------|-------|
| D1 | Mode hapus | **Soft delete** (`@DeleteDateColumn`), bukan hard delete |
| D2 | Otorisasi | `@Roles(UserRole.ADMIN)` — hard-coded, bukan lewat `FeatureDefinition` |
| D3 | Titik masuk UI | **Massal** lewat bar seleksi, di **dua** halaman (ticket list + Oracle K2) |
| D4 | Konfirmasi | Ketik **jumlah** ticket (bukan nomor ticket) |
| D5 | Restore | **Tidak dibuat sekarang** — kolom & data siap, UI menyusul bila diminta |
| D6 | Oracle K2 | Bukan entity terpisah — sama-sama tabel `tickets`, satu mekanisme hapus |
| D7 | Manager | Hak `ticketing.delete` yang sudah ada **dicabut** lewat migration |
| D8 | Bahasa output | Indonesia |

### Catatan D4 — kenapa bukan nomor ticket

Pilihan awal adalah "ketik nomor ticket", tetapi tidak kompatibel dengan D3: menghapus 5 ticket berarti mengetik 5 nomor. Konflik ini disurfacekan dan diputuskan ulang menjadi "ketik jumlah".

### Catatan D6 — Oracle K2 bukan tabel sendiri

Terbukti dari dua tempat:

- `ticket.entity.ts:45` — `ORACLE_REQUEST = 'ORACLE_REQUEST'` hanyalah salah satu nilai `TicketType`.
- `oracle-ticket-access.util.ts` — `isOracleK2Category(category, ticketType)` mengklasifikasi baris `tickets`, bukan memuat entity lain.

Konsekuensi: **satu** endpoint dan **satu** service melayani keduanya. Yang berbeda hanya halaman frontend yang memanggilnya.

---

## 1. Masalah

Tidak ada jalur hapus ticket sama sekali. `tickets.controller.ts` punya 18 route dan **nol** `@Delete`. Ticket salah input, duplikat, atau uji coba menumpuk permanen di daftar semua orang.

Sebagian perkakas justru sudah ada tetapi menganggur — bukti bahwa fitur ini pernah direncanakan lalu tidak diselesaikan:

| Artefak | Lokasi | Status |
|---------|--------|--------|
| `BulkDeleteTicketsDto` | `dto/bulk-update.dto.ts:32` | terdefinisi, **tidak dipakai** (grep hanya menemukan deklarasinya) |
| `AuditAction.DELETE_TICKET` | `audit-log.entity.ts:31` | terdefinisi, **tidak dipakai** |
| `ticketing.delete` | `permissions.service.ts:110` | terdefinisi, **tidak ditegakkan** |
| `Trash2` | `BulkActionsBar.tsx:2` | di-import, **tidak pernah dirender** |

Spec ini menyambungkan yang sudah ada, bukan membangun dari nol.

---

## 2. Sasaran & non-sasaran

### Sasaran

- ADMIN dapat menghapus ticket (termasuk Oracle K2) secara massal dari UI.
- Penghapusan dapat dibatalkan (data tetap ada di DB) dan tercatat di audit log.
- Ticket terhapus hilang dari **semua** query baca: list, detail, statistik, pencarian, notifikasi.
- Isolasi site tetap berlaku — tidak ada jalur pintas lintas-site lewat endpoint baru.

### Non-sasaran

- **UI restore** (D5). Kolom `deletedAt` menyimpan datanya; layar pemulihan menyusul bila diminta.
- **Hard delete / purge**. Tidak ada retensi otomatis maupun pembersihan berkala di ronde ini.
- **Hapus satuan** dari halaman detail ticket. Hanya massal (D3).
- **Migrasi ke sistem `PageAccess`**. Otorisasi hard-coded (D2).
- Menghapus baris turunan (`ticket_messages`, `time_entries`, dll.). Lihat §3.4.

---

## 3. Desain backend

### 3.1 Entity

Tambahkan pada `apps/backend/src/modules/ticketing/entities/ticket.entity.ts`:

```ts
@DeleteDateColumn()
deletedAt: Date;
```

Mengikuti persis idiom yang sudah dipakai di codebase (CLAUDE.md §4 — ikuti pattern existing):

- `knowledge-base/entities/article.entity.ts:75`
- `renewal/entities/renewal-contract.entity.ts:123`
- `vpn/entities/vpn-access.entity.ts:79`

### 3.2 Migration A — `AddDeletedAtToTickets`

File: `apps/backend/src/migrations/1787366400000-AddDeletedAtToTickets.ts`

Mengikuti gaya `1787200258000-AddSiteIdToFoundItemClaims.ts` (idempoten, `IF NOT EXISTS`, `down()` simetris):

```sql
-- up
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "idx_tickets_deleted_at"
    ON "tickets" ("deletedAt") WHERE "deletedAt" IS NULL;

-- down
DROP INDEX IF EXISTS "idx_tickets_deleted_at";
ALTER TABLE "tickets" DROP COLUMN IF EXISTS "deletedAt";
```

Index **partial** (`WHERE "deletedAt" IS NULL`) karena setiap query baca kini menambahkan predikat itu, sementara baris terhapus diharapkan sangat sedikit. Index penuh akan membuang ruang untuk baris yang tidak pernah di-scan.

### 3.3 Migration B — `RevokeManagerTicketDelete`

File: `apps/backend/src/migrations/1787366401000-RevokeManagerTicketDelete.ts`

**Kenapa migration wajib, bukan sekadar edit kode.** Preset Manager (`permissions.service.ts:359`) saat ini memberi:

```ts
'ticketing.delete': { canView: true, canCreate: false, canEdit: false, canDelete: true },
```

Mengubah baris itu saja **tidak berefek pada baris yang sudah ada di DB**, karena `seedDefaultPresets` hanya mengisi key yang masih `undefined` (`permissions.service.ts:504-509`):

```ts
const updatedPermissions = { ...exists.permissions };
for (const [key, value] of Object.entries(preset.permissions || {})) {
    if (updatedPermissions[key] === undefined) {   // ← key yang sudah ada dilewati
        updatedPermissions[key] = value;
        modified = true;
    }
}
```

Jadi perbaikan butuh dua langkah: ubah literal di `permissions.service.ts:359` menjadi `canDelete: false` (agar instalasi baru benar), **dan** migration yang menulis ulang baris preset Manager yang sudah tersimpan (agar instalasi lama ikut benar).

Ini murni higiene — `ticketing.delete` tidak pernah ditegakkan di endpoint mana pun, sehingga tidak ada kemampuan nyata yang hilang dari Manager. Yang dicabut adalah hak yang menyesatkan di layar pengaturan.

### 3.4 Baris turunan sengaja tidak disentuh

Tujuh tabel merujuk `ticketId`: `ticket_messages`, `ticket_survey`, `time_entries`, `access_request`, `lost_item_report`, `workflow_execution`, `notification`.

Soft delete **tidak** menyentuh satu pun. Inilah alasan utama D1 dipilih: hard delete akan memaksa keputusan cascade untuk tujuh tabel sekaligus, dan setiap keputusan itu tidak dapat dibatalkan.

`Ticket` tidak punya relasi ber-`cascade: true` (diperiksa di `ticket.entity.ts` — hanya `onDelete: 'SET NULL'` pada dua `ManyToOne` ke `User`), sehingga `softRemove` tidak akan merambat tanpa diminta.

### 3.5 Endpoint

Pada `tickets.controller.ts`, meniru pola `bulkUpdate` (baris 297-315):

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

Catatan implementasi:

- `Delete` harus ditambahkan ke import `@nestjs/common` (baris 1-16) — saat ini belum ada.
- `BulkDeleteTicketsDto` diimport dari `../dto/bulk-update.dto` (sudah ada, tinggal dipakai). DTO tersebut sudah memvalidasi `@IsArray()` + `@IsUUID(4, { each: true })` — memenuhi CLAUDE.md §8 "validate ALL external input" tanpa kode baru.
- Path `'bulk'` bukan `':id'`, jadi tidak bentrok dengan route berparameter.

### 3.6 Service `bulkSoftDelete`

Pada `ticket-update.service.ts`, mencerminkan `bulkUpdate` (baris 457-502):

```ts
async bulkSoftDelete(
    ticketIds: string[],
    userId: string,
): Promise<{ deleted: number; failed: string[] }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const tickets = await this.ticketRepo.find({ where: { id: In(ticketIds) } });
    if (tickets.length === 0) throw new NotFoundException('No tickets found');

    // Fail-closed: satu ticket lintas-site membatalkan seluruh batch.
    for (const ticket of tickets) {
        validateTicketSiteAccess(
            user.role as UserRole,
            (user as any).siteId ?? null,
            (ticket as any).siteId ?? null,
        );
    }

    // ... transaksi: softRemove seluruh batch, atomik
    // ... audit per ticket via auditService.logAsync
    // return { deleted, failed }
}
```

**Isolasi site.** `validateTicketSiteAccess` (`ticketing/utils/site-access.util.ts:59`) melempar `ForbiddenException` bila gagal. ADMIN termasuk `TICKET_CROSS_SITE_ROLES`, jadi dalam praktik selalu lolos — pemanggilan tetap ada agar aturan tidak bergeser diam-diam bila D2 dilonggarkan di kemudian hari. Ini sama persis dengan yang dilakukan `bulkUpdate`.

**`failed`.** ID yang diminta tetapi tidak ditemukan di DB (sudah terhapus atau salah ketik) masuk ke `failed`, bukan melempar exception. Selisih `ticketIds` dengan ticket yang benar-benar ter-`softRemove`. Bentuk balasan `{ deleted, failed }` konsisten dengan `{ updated, failed }` milik `bulkUpdate`.

**Atomik vs partial.** Pelanggaran site membatalkan seluruh batch (throw sebelum transaksi dimulai). ID yang tidak ditemukan tidak membatalkan apa pun — sisanya tetap terhapus dan dilaporkan lewat `failed`.

**Audit.** Per ticket, mengikuti `knowledge-base.service.ts:165-198`:

```ts
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
    description: `Ticket "${ticket.ticketNumber}" deleted (soft)`,
});
```

`logAsync` membungkus `log()` dalam `setImmediate` + try/catch, sehingga kegagalan audit tidak menggagalkan penghapusan. `entityId` bertipe `varchar(255)` — muat untuk UUID.

Snapshot `oldValue` adalah satu-satunya jejak manusiawi yang tersisa selama UI restore belum ada (D5) — `ticketNumber` di sini yang memungkinkan operator menemukan kembali baris yang salah dihapus.

### 3.7 Query baca — apa yang otomatis, apa yang manual

Ini bagian yang paling menentukan besar-kecilnya perubahan, jadi diverifikasi langsung ke sumber TypeORM 0.3.28, bukan diasumsikan.

**Otomatis — entity utama.** `QueryBuilder.js:544-557`: setiap `select` menambahkan `alias.deletedAt IS NULL` bila metadata punya `deleteDateColumn` dan `withDeleted` tidak diset.

**Otomatis — relasi yang di-join.** `SelectQueryBuilder.js:1008-1013`: kondisi yang sama disuntikkan ke setiap `JOIN`:

```js
if (joinAttributeMetadata.deleteDateColumn && !this.expressionMap.withDeleted) {
    const conditionDeleteColumn = `${aliasName}.${joinAttributeMetadata.deleteDateColumn.propertyName} IS NULL`;
    joinAttribute.condition = joinAttribute.condition
        ? ` ${joinAttribute.condition} AND ${conditionDeleteColumn}`
        : `${conditionDeleteColumn}`;
}
```

Ini menutup pertanyaan terbuka yang sebelumnya saya tandai belum terverifikasi: `leftJoinAndSelect('x.ticket', ...)` di `access-request.service.ts`, `lost-item.service.ts`, dan `time-tracking.service.ts` **ikut terfilter tanpa perubahan kode**. Tidak ada `relationLoadStrategy: 'query'` di seluruh backend (grep kosong) dan tidak ada relasi lazy `Promise<>` di `ticket.entity.ts` (grep kosong), jadi jalur join inilah yang berlaku.

**Otomatis — semua query builder.** `dataSource.createQueryBuilder` / `entityManager.createQueryBuilder` tidak dipakai di mana pun (grep kosong); seluruh query builder berangkat dari repository dan mewarisi metadata entity. 28 file yang meng-inject `Repository<Ticket>` karena itu **tidak perlu disentuh**.

**Manual — tiga baris SQL mentah.** `notification-center.service.ts` baris 327, 331, 335 memakai `entityManager.query()` dengan SQL literal, yang melewati metadata sepenuhnya. Tambahkan `AND "deletedAt" IS NULL` pada ketiganya. Presedennya ada di file yang sama, baris 347:

```sql
SELECT ... FROM renewal_contracts
WHERE "status" != 'EXPIRED' AND "endDate" < $1 AND "deletedAt" IS NULL ...
```

Dua `query()` lain yang menyentuh `tickets` (`health.service.ts:288,320`) adalah `SELECT 1 FROM tickets LIMIT 1` — probe konektivitas, tidak membaca data, sengaja dibiarkan.

**Total perubahan query baca: 3 baris.**

---

## 4. Desain frontend

Tombol "Hapus" hanya dirender bila `user?.role === 'ADMIN'`. Ini kenyamanan UI, bukan kontrol keamanan — penegakan sesungguhnya ada di `@Roles(UserRole.ADMIN)` (§3.5).

### 4.1 Dua bar terpisah

| Halaman | Bar | Perubahan |
|---------|-----|-----------|
| `BentoTicketListPage.tsx` (dirender baris 739) | `components/BulkActionsBar.tsx` (shared) | tambah prop opsional `onDelete?` |
| `BentoOracleK2TicketsPage.tsx` | `BulkAssignBar` lokal, **baris 540** | tambah tombol Hapus |

Halaman Oracle K2 **tidak** memakai `BulkActionsBar` bersama; ia mendefinisikan `BulkAssignBar` sendiri di baris 540 dan merendernya di baris 494. Karena itu menyentuh satu bar saja akan meninggalkan Oracle K2 tanpa fitur hapus — bertentangan langsung dengan permintaan asli. State seleksi di halaman itu sudah ada dan siap dipakai.

`Trash2` sudah di-import di `BulkActionsBar.tsx:2` tetapi belum pernah dirender — tinggal dipakai.

**Konsekuensi yang diterima:** dua bar akan menyimpang seiring waktu. Menyatukannya adalah refactor di luar cakupan permintaan ini (CLAUDE.md §4 — minimal changes; §10 — refactor tak diminta = P3).

### 4.2 Dialog konfirmasi

`components/ui/ConfirmationDialog.tsx` **tidak perlu diubah**. Ia sudah punya `variant="destructive"` dan slot `children` (interface baris 18, render baris 127: `{children && <div className="px-6 pb-2">{children}</div>}`) — persis tempat input jumlah diletakkan.

```
⚠  Hapus 5 ticket?

   TCK-8821, TCK-8790, TCK-8788, TCK-8771, TCK-8769

   Ketik  5  untuk konfirmasi:  [____]

                    [Batal]  [Hapus] ← disabled sampai cocok
```

Daftar nomor ticket ditampilkan agar operator melihat **apa** yang akan hilang; input jumlah memaksa jeda sadar sebelum aksi yang (tanpa UI restore) hanya dapat dipulihkan lewat query DB produksi.

Setelah sukses: `invalidateQueries` + toast + `clearSelection`.

---

## 5. Testing

Jest **wajib serial** — `--runInBand`, satu file per satu. Menjalankan paralel membuat mesin hang.

| # | File | Yang dibuktikan |
|---|------|-----------------|
| 1 | `ticket-soft-delete.spec.ts` (baru) | ADMIN berhasil; MANAGER/AGENT/AGENT_ORACLE/USER → 403; `deletedAt` terisi; baris masih ada dengan `withDeleted: true`; audit `DELETE_TICKET` tercatat; ID tak dikenal masuk `failed` tanpa menggagalkan sisanya |
| 2 | `ticket-query.soft-delete.spec.ts` (baru) | Ticket terhapus absen dari list, paginated, Oracle K2 queue, dashboard stats, dan pencarian |
| 3 | (bagian dari #2) | Ticket terhapus absen dari hasil `leftJoinAndSelect` di `access-request` / `lost-item` — memverifikasi perilaku join §3.7 secara empiris, bukan hanya dari membaca sumber TypeORM |
| 4 | regresi | `ticket-query.site-isolation.spec.ts`, `workload.site-isolation.spec.ts` |

Uji #3 tetap dipertahankan meski §3.7 sudah membuktikannya dari kode sumber: membaca implementasi library membuktikan apa yang dilakukannya hari ini, sedangkan uji mengunci perilaku itu terhadap upgrade TypeORM berikutnya.

---

## 6. Risiko

**R1 — Salah hapus tidak dapat dipulihkan lewat UI.** Konsekuensi langsung dari D5. Data aman di DB (`deletedAt` terisi, baris utuh) dan `oldValue` di audit log menyimpan `ticketNumber`, tetapi pemulihan menuntut query manual ke DB produksi:

```sql
UPDATE tickets SET "deletedAt" = NULL WHERE "ticketNumber" = 'TCK-8821';
```

Konfirmasi ketik-jumlah (§4.2) adalah satu-satunya pengaman sebelum aksi terjadi. Bila hapus massal ternyata sering dipakai, UI restore naik prioritas.

**R2 — Dua bar seleksi menyimpang.** Diterima secara sadar (§4.1). Perubahan berikutnya pada perilaku hapus harus disalin ke dua tempat; risiko satu tempat terlewat itu nyata.

**R3 — SQL mentah baru di masa depan.** Tiga baris di §3.7 diperbaiki manual, tetapi tidak ada yang mencegah `entityManager.query('... FROM tickets ...')` baru ditulis tanpa `AND "deletedAt" IS NULL` dan diam-diam membocorkan ticket terhapus. Tidak ada lint rule untuk ini. Mitigasi saat ini hanyalah code review dan uji #2.

---

## 7. Ringkasan perubahan

| Berkas | Aksi |
|--------|------|
| `ticketing/entities/ticket.entity.ts` | + `@DeleteDateColumn() deletedAt` |
| `migrations/1787366400000-AddDeletedAtToTickets.ts` | baru |
| `migrations/1787366401000-RevokeManagerTicketDelete.ts` | baru |
| `permissions/permissions.service.ts:359` | `canDelete: true` → `false` (preset Manager) |
| `ticketing/presentation/tickets.controller.ts` | + route `@Delete('bulk')`, + import `Delete` & `BulkDeleteTicketsDto` |
| `ticketing/services/ticket-update.service.ts` | + `bulkSoftDelete` |
| `notifications/notification-center.service.ts:327,331,335` | + `AND "deletedAt" IS NULL` |
| `ticket-board/components/BulkActionsBar.tsx` | + prop `onDelete?`, render `Trash2` |
| `ticket-board/pages/BentoTicketListPage.tsx` | + handler & dialog |
| `ticket-board/pages/BentoOracleK2TicketsPage.tsx` | + tombol Hapus pada `BulkAssignBar` (baris 540) + handler & dialog |
| `ticket-soft-delete.spec.ts` | baru |
| `ticket-query.soft-delete.spec.ts` | baru |

Tidak berubah: `ConfirmationDialog.tsx` (§4.2), `BulkDeleteTicketsDto` (§3.5), 28 file yang meng-inject `Repository<Ticket>` (§3.7).
