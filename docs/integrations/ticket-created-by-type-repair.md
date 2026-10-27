# Repair: HTTP 500 tiket iPop / EBBK (SQLSTATE 42883)

## Penyebab dan cakupan

Migration `AddTicketCreatedBy1793200000000` membuat `tickets.createdById` sebagai varchar. Pada database dengan `users.id` UUID, lookup TypeORM yang memuat relasi `createdBy` gagal `operator does not exist: uuid = character varying`, termasuk lookup idempotensi sebelum POST tiket. iPop dan Integrasi Aplikasi (misalnya EBBK) memakai `IpopTicketService` yang sama.

Forward migration `AlignTicketCreatedByIdType1794040000000` menyelaraskan tipe kolom ke tipe fisik `users.id`. Tidak mengubah secret, payload, externalRef, data tiket, atau menambahkan foreign key. UUID invalid menggagalkan migration; jangan menggantinya menjadi NULL. Migration forward-only untuk menghindari rollback yang mengembalikan join rusak.

## Production / Coolify

1. Backup DB dan pastikan backup berhasil sebelum deployment.
2. Jalankan preflight read-only pada database tujuan:

```sql
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND ((table_name = 'users' AND column_name = 'id')
    OR (table_name = 'tickets' AND column_name = 'createdById'));
```

3. Deploy image backend yang **sudah memuat** migration baru. Mengulang deploy image lama tidak memperbaiki schema. Pada konfigurasi aplikasi `NODE_ENV=production`, startup TypeORM menjalankan migration pending. Pastikan migration tersedia sebagai file compiled di `dist/src/migrations/` dan periksa log keberhasilannya. Jangan mengaktifkan `DB_SYNCHRONIZE` atau mengubah ledger migration secara manual. `npm run migration:run` memakai source TypeScript/ts-node, sehingga bukan instruksi yang dapat diasumsikan tersedia dalam image production.
4. `ALTER COLUMN TYPE` mengambil lock tabel: lakukan pada jendela deployment yang sesuai. Jika cast/constraint gagal, hentikan rollout dan periksa metadata/data dengan akses yang sesuai; jangan menonaktifkan constraint atau menghapus data.
5. Verifikasi ledger dan ulangi preflight:

```sql
SELECT name FROM migrations WHERE name = 'AlignTicketCreatedByIdType1794040000000';
```

6. Verifikasi GET tiket dengan credential integrasi normal untuk iPop dan EBBK, lalu izinkan retry dengan **externalRef yang sama**. Lookup yang tidak menemukan tiket harus berhasil dengan hasil kosong/404 sesuai endpoint, bukan 500. Jangan membuat reference baru untuk tiket yang sudah diantrekan. Pantau `DATABASE_REQUEST_FAILED`, correlation ID, dan SQLSTATE bila masih gagal.

Health check DB terhubung saja bukan bukti query tiket sudah pulih. Status production baru terverifikasi setelah request integrasi berhasil di server tujuan.

## Pengujian

Regression PostgreSQL memakai `TEST_DATABASE_URL` dan schema sementara dengan transaksi yang di-rollback. Tidak memodifikasi tabel aplikasi. Jalankan serial, satu file per invocation:

```sh
npm test -- --runTestsByPath src/modules/integrations/ipop/__tests__/created-by-type.integration.spec.ts
npm test -- --runTestsByPath src/shared/core/filters/database-exception.filter.spec.ts
npm test -- --runTestsByPath src/modules/integrations/ipop/__tests__/ipop-ticket.service.spec.ts
npm test -- --runTestsByPath src/modules/integrations/apps/__tests__/app-scope.spec.ts
npm run build
```

Tanpa `TEST_DATABASE_URL`, suite PostgreSQL di-skip dan tidak boleh diklaim sebagai verifikasi DB. Gunakan DB khusus pengujian bila tersedia. Test tidak menjalankan HTTP autentikasi production atau insert tiket nyata lewat integrasi.
