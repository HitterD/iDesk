# TV Board Light Command Design

## Context

TV Board publik sudah menampilkan tiga status tiket real-time per site. Tampilan perlu lebih terbaca dari layar TV di ruang kantor terang: jumlah/status dominan, judul kendala jelas, requester/assignee sekunder. Oracle/K2 harus tampak tanpa menjadi kolom status baru atau mengubah akses/public endpoint.

## Visual direction

**Light Command:** latar abu-biru terang, header putih mengambang, kontras teks tinggi, dan tiga kolom status tetap.

- Header: nama site, kode site, label Service Desk, jam besar, badge Waiting Vendor dan Overdue.
- Kolom: Open/slate, In Progress/blue, Resolved/emerald; count status besar dan mudah dipindai dari jauh.
- Card: shell tipis terang, accent priority, deskripsi 2–3 baris lebih dominan; requester dan assignee kecil sebagai metadata.
- Overdue: tetap merah kuat.
- Motion: hanya opacity/transform untuk first render, `motion-reduce` mematikan animasi; tidak ada animasi per socket update agar layar stabil.
- Loading/error memakai palet Light Command.

## Oracle/K2 classification

Status tetap hanya **Open**, **In Progress**, dan **Resolved**. Oracle/K2 bukan kolom keempat dan tidak punya filter interaktif.

Backend menambah `isOracleRequest: boolean` ke `TvBoardCard`, diturunkan dari:

```ts
ticket.ticketType === TicketType.ORACLE_REQUEST ||
ticket.category === 'ORACLE_REQUEST'
```

`ticketType` adalah nilai canonical; `category` menjaga data legacy. Endpoint publik dan socket hanya mengirim boolean derived, bukan field internal ticket type/category.

Frontend menampilkan badge kecil navy solid `ORACLE / K2` pada kartu terkait. Badge tidak mengalahkan judul kendala dan tidak memakai ungu, teal, atau amber supaya tidak bertabrakan dengan warna resolved/priority/SLA.

## Files

- `apps/backend/src/modules/tv-board/tv-board.service.ts`: tambah `isOracleRequest` pada interface dan projection card.
- `apps/backend/src/modules/tv-board/tv-board.service.spec.ts`: test canonical, legacy, dan normal classification.
- `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts`: assert live payload membawa derived property.
- `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts`: tambah field type.
- `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx`: redesign Light Command dan badge navy.
- `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx`: verify badge Oracle/K2 dan visual contracts existing.

## Data flow

`TvBoardService.getBoardData()` membentuk card dengan boolean derived. Controller HTTP dan `TvBoardGateway` sudah mengembalikan `TvBoardData` yang sama, sehingga initial fetch dan event `tv-board:update` otomatis sinkron. Tidak ada endpoint, query parameter, polling, atau Socket.IO event baru.

## Verification

```bash
cd apps/backend
npx jest --runInBand tv-board
npx tsc --noEmit

cd ../frontend
npx vitest run --pool=forks --maxWorkers=1 --no-file-parallelism BentoTvBoardPage.smoke.test.tsx
npx tsc --noEmit
```

Manual: generate token, buka `/tv/:token`, pastikan tiga kolom tetap ada, kartu Oracle/K2 berbadge navy, socket update mengubah board tanpa reload, dan layout tetap terbaca pada TV/viewport lebar.
