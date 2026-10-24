# API Aplikasi Terhubung iDesk

Panduan untuk developer aplikasi kantor lain, misalnya **EBBK**, yang ingin:

- membuat tiket iDesk dari dalam aplikasinya, dengan form yang sama seperti modal "Buat Tiket" di iDesk;
- memantau progres tiket itu;
- membaca dan membalas chat tiketnya.

Semua tiket dibuat **atas nama NIK HRIS**. Satu API ini dipakai bersama oleh semua aplikasi. Yang membedakan adalah izin masing-masing aplikasi, yang diatur admin iDesk.

> Contoh di dokumen ini: **EBBK**, yang hanya boleh membuat tiket ke modul **Web Developer**.

---

## 1. Ringkasan cepat

| | |
|---|---|
| Base URL | `https://idesk.santos.co.id/api/v1/integrations/apps` |
| Format | JSON (UTF-8), request dan response |
| Autentikasi | 3 header: client ID, timestamp, tanda tangan HMAC-SHA256 ([bagian 3](#3-autentikasi-tanda-tangan-request)) |
| Batas | 120 request per menit per aplikasi |
| Identitas orang | NIK HRIS (`employeeId` di iDesk), wajib sudah terdaftar dan aktif di iDesk |
| Sifat pembuatan tiket | Idempoten lewat `externalRef`: kirim ulang aman, tidak membuat tiket ganda |

Alurnya dalam 4 langkah:

1. Admin iDesk mendaftarkan aplikasi di **Settings → Integrasi Aplikasi** (bagian 2), lalu memberikan **Client ID** dan **Client secret**.
2. Aplikasi memanggil `GET /me` untuk memastikan tanda tangannya benar.
3. Aplikasi mengirim tiket dengan `POST /tickets`, lalu menyimpan `ticketNumber` yang dikembalikan.
4. Progres dibaca dengan `GET /tickets/{ticketNumber}`, atau diterima otomatis lewat **webhook**.

---

## 2. Izin aplikasi (allowance)

Admin mengatur 4 hal per aplikasi di **Settings → Integrasi Aplikasi**:

| Pengaturan | Keterangan | Contoh EBBK |
|---|---|---|
| **Client ID** | Nama unik aplikasi (huruf kecil, angka, `-`). Dikirim di setiap request dan menjadi label sumber tiket (`origin`). | `ebbk` |
| **Modul** | Antrean tiket yang boleh dituju. Modul lain ditolak dengan `403`. | Web Developer Request |
| **Fitur** | Endpoint yang boleh dipanggil (tabel di bawah). | Keempat fitur |
| **URL webhook** | Opsional. Alamat yang menerima notifikasi perubahan tiket. | `https://ebbk.santos.co.id/api/idesk/webhook` |

### Fitur dan endpoint yang dibukanya

| Fitur (di layar admin) | Kode izin | Endpoint |
|---|---|---|
| Buat tiket | `tickets:create` | `GET /modules`, `POST /tickets` |
| Lihat progres | `tickets:read` | `GET /tickets`, `GET /tickets/{ticketNumber}` |
| Baca chat | `messages:read` | `GET /tickets/{ticketNumber}/messages` |
| Balas chat | `messages:write` | `POST /tickets/{ticketNumber}/messages` |
| Selalu boleh | – | `GET /me` |

Batasan yang **selalu** berlaku untuk setiap aplikasi:

- Aplikasi hanya melihat **tiket yang ia buat sendiri**. Tiket yang dibuat dari iDesk, iPop, atau aplikasi lain tidak terlihat dan menghasilkan `404`.
- **Catatan internal tim IT tidak pernah keluar** lewat API maupun webhook.
- Lampiran dikirim saat membuat tiket. Membuka lampiran dan menambah lampiran di chat dilakukan di iDesk lewat `url` tiket.
- Admin bisa **menonaktifkan** aplikasi atau **membuat secret baru** kapan saja. Setelah itu, request dengan secret lama langsung ditolak `401`.

---

## 3. Autentikasi (tanda tangan request)

Setiap request membawa 3 header:

| Header | Isi |
|---|---|
| `x-idesk-client-id` | Client ID, misalnya `ebbk` |
| `x-idesk-timestamp` | Waktu sekarang dalam **milidetik** Unix epoch, misalnya `1793500000000` |
| `x-idesk-signature` | `hex( HMAC-SHA256( secret, "<timestamp>.<body>" ) )` |

Aturan penting:

- **Tanda tangani teks body yang persis sama dengan yang dikirim.** Serialisasi JSON sekali ke string, tanda tangani string itu, lalu kirim string yang sama. Jangan biarkan HTTP client men-serialisasi ulang.
- Untuk `GET`, body adalah **string kosong**, sehingga yang ditandatangani adalah `"<timestamp>."`.
- Jam server harus tepat (NTP). Timestamp yang selisihnya lebih dari **5 menit** dari jam iDesk ditolak.
- Secret disimpan di konfigurasi server (environment variable atau vault), **bukan di kode dan bukan di browser**. Panggil API ini dari backend aplikasi, jangan dari JavaScript di browser.

### Node.js

```js
import { createHmac } from 'crypto';

const BASE = 'https://idesk.santos.co.id/api/v1/integrations/apps';
const CLIENT_ID = 'ebbk';
const SECRET = process.env.IDESK_SECRET;

export async function idesk(method, path, payload) {
  const body = payload ? JSON.stringify(payload) : '';
  const ts = String(Date.now());
  const signature = createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');
  const res = await fetch(BASE + path, {
    method,
    body: body || undefined,
    headers: {
      'Content-Type': 'application/json',
      'x-idesk-client-id': CLIENT_ID,
      'x-idesk-timestamp': ts,
      'x-idesk-signature': signature,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.message ?? `HTTP ${res.status}`), { status: res.status, data });
  return data;
}
```

### PHP

```php
function idesk(string $method, string $path, ?array $payload = null): array {
    $body = $payload === null ? '' : json_encode($payload, JSON_UNESCAPED_UNICODE);
    $ts = (string) round(microtime(true) * 1000);
    $sig = hash_hmac('sha256', $ts . '.' . $body, getenv('IDESK_SECRET'));

    $ch = curl_init('https://idesk.santos.co.id/api/v1/integrations/apps' . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_POSTFIELDS => $body === '' ? null : $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-idesk-client-id: ebbk',
            "x-idesk-timestamp: $ts",
            "x-idesk-signature: $sig",
        ],
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($response, true) ?? [];
    if ($status >= 400) throw new RuntimeException($data['message'] ?? "HTTP $status", $status);
    return $data;
}
```

### C# (.NET)

```csharp
public sealed class IDeskSigningHandler(string clientId, string secret) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var sig = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{ts}.{body}"))).ToLowerInvariant();
        request.Headers.Add("x-idesk-client-id", clientId);
        request.Headers.Add("x-idesk-timestamp", ts);
        request.Headers.Add("x-idesk-signature", sig);
        return await base.SendAsync(request, ct);
    }
}
// Kirim body sebagai StringContent(json, Encoding.UTF8, "application/json") agar byte yang ditandatangani = byte yang terkirim.
```

### Tes pertama: `GET /me`

```json
{ "clientId": "ebbk", "name": "EBBK", "modules": ["web-developer"],
  "permissions": ["tickets:create", "tickets:read", "messages:read", "messages:write"], "webhook": true }
```

Jika hasilnya `401`, periksa urutan ini: Client ID, secret (sudah diganti?), jam server, dan apakah body yang ditandatangani sama persis dengan yang dikirim.

---

## 4. Membuat tiket: `POST /tickets`

### 4.1 Pilihan NIK: untuk siapa tiketnya, dan siapa yang mengirim

| Field | Wajib | Arti |
|---|---|---|
| `requester.nik` | **Ya** | NIK HRIS **pemilik tiket**, yaitu orang yang punya masalah. Tiket muncul di "Tiket Saya" miliknya, dan notifikasi dikirim ke dia. |
| `submittedBy.nik` | Tidak | NIK HRIS **orang yang mengirim** dari aplikasi, jika berbeda dari pemohon. Ia tercatat sebagai pembuat tiket dan tetap bisa melihat serta membalas tiketnya. |

Contoh skenario:

| Situasi di EBBK | `requester.nik` | `submittedBy.nik` |
|---|---|---|
| User melapor masalahnya sendiri | NIK user yang login | *(tidak diisi)* |
| Admin keuangan melaporkan atas nama staf | NIK staf yang bermasalah | NIK admin keuangan |
| Sistem EBBK melapor otomatis (mis. job gagal) | NIK PIC proses itu | *(tidak diisi)* |

- Sebagai pengganti `nik`, `requester` dan `submittedBy` boleh memakai `email`, tetapi NIK lebih disarankan.
- NIK yang tidak terdaftar atau tidak aktif di iDesk menghasilkan `422` beserta pesannya (`Requester ...` atau `Submitter ...`).

### 4.2 Field (sama dengan modal "Buat Tiket" iDesk)

| Field | Wajib | Aturan | Label di modal iDesk |
|---|---|---|---|
| `externalRef` | **Ya** | ID tiket di aplikasi Anda, 1–100 karakter `A-Z a-z 0-9 . _ : - /`, unik per aplikasi. Kirim ulang dengan nilai sama → tiket yang sama dikembalikan. | – |
| `module` | **Ya** | Slug dari `GET /modules`. EBBK: `web-developer`. | Tujuan |
| `category` | Kondisional | Wajib untuk `it-support`. Modul developer tidak perlu diisi (otomatis). | Kategori |
| `priority` | **Ya** | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Seberapa mendesak? (lihat 4.3) |
| `title` | **Ya** | 5–200 karakter | Judul |
| `description` | **Ya** | 3–5000 karakter, teks biasa | Detail masalah |
| `criticalReason` | Kondisional | Wajib jika `priority` = `CRITICAL`, 3–500 karakter | Alasan blocker |
| `requester` | **Ya** | `{ "nik": "..." }`, lihat 4.1 | – |
| `submittedBy` | Tidak | `{ "nik": "..." }`, lihat 4.1 | – |
| `device`, `software` | Tidak | Maksimal 100 karakter | Perangkat |
| `attachments` | Tidak | Maksimal 5 file, masing-masing ≤ 10 MB setelah decode: `[{ "fileName": "layar.png", "contentBase64": "..." }]`. Ekstensi yang diterima: jpg, jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, ppt, pptx, zip, rar, 7z, txt, csv, mp4, mov, webm. Isi file harus cocok dengan ekstensinya. | Lampirkan |

### 4.3 Prioritas (tampilkan seperti di iDesk)

| Nilai API | Label | Penjelasan untuk user |
|---|---|---|
| `LOW` | Low | Minor atau kosmetik |
| `MEDIUM` | Normal | Dampak sedang |
| `HIGH` | Urgent | Pekerjaan terganggu tapi masih ada cara lain |
| `CRITICAL` | Blocker | Pekerjaan berhenti total; wajib isi alasan |

### 4.4 Contoh EBBK

```json
POST /tickets
{
  "externalRef": "EBBK-BBK_2600064552",
  "module": "web-developer",
  "priority": "HIGH",
  "title": "Approval transaksi E-BBK lompat BBK_2600064552",
  "description": "Approve dari saya seharusnya masuk ke Pak Henryanto (Manager Finance), tapi lompat ke Kasir.",
  "requester": { "nik": "00061001" },
  "submittedBy": { "nik": "00061002" },
  "attachments": [ { "fileName": "screenshot.png", "contentBase64": "iVBORw0KGgo..." } ]
}
```

Respons:

| Kode | Arti | Tindakan |
|---|---|---|
| `201` | Tiket dibuat | Simpan `ticketNumber` dan `ticketId` |
| `200` | Tiket untuk `externalRef` ini sudah ada | Aman. Pakai tiket yang dikembalikan; biasanya terjadi setelah retry karena timeout. |
| `400` | Data tidak valid | Tampilkan `message` ke user |
| `403` | Modul tidak diizinkan untuk aplikasi ini | Minta admin iDesk menambahkan modul |
| `422` | NIK pemohon/pengirim tidak terdaftar atau tidak aktif | Minta user menghubungi IT |

---

## 5. Data tiket

Semua endpoint tiket mengembalikan bentuk yang sama:

```json
{
  "ticketId": "bb4ed960-03e1-4428-8f64-136f60340381",
  "ticketNumber": "241026-FIN-0003",
  "externalRef": "EBBK-BBK_2600064552",
  "origin": "EBBK",
  "requester": { "nik": "00061001", "name": "Sari Dewi" },
  "submittedBy": { "nik": "00061002", "name": "Budi Santoso" },
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "module": "web-developer",
  "category": "WEB_DEV_REQUEST",
  "title": "Approval transaksi E-BBK lompat BBK_2600064552",
  "assignee": { "name": "Agent Web" },
  "slaTarget": "2026-10-26T09:00:00.000Z",
  "visit": null,
  "createdAt": "2026-10-24T03:00:00.000Z",
  "updatedAt": "2026-10-24T03:10:00.000Z",
  "resolvedAt": null,
  "closedAt": null,
  "url": "https://idesk.santos.co.id/client/tickets/bb4ed960-03e1-4428-8f64-136f60340381"
}
```

### Status

| `status` | Tampilkan sebagai | Keterangan |
|---|---|---|
| `TODO` | Open | Belum diambil tim |
| `IN_PROGRESS` | In Progress | Sedang dikerjakan |
| `WAITING_VENDOR` | Menunggu | SLA dijeda, misalnya menunggu vendor atau barang |
| `RESOLVED` | Selesai, menunggu konfirmasi | Pemohon mengonfirmasi di iDesk (buka `url`) |
| `CLOSED` | Ditutup | Final |
| `CANCELLED` | Dibatalkan | Final |

- Waktu selalu dalam **UTC** (ISO 8601). Konversi ke WIB untuk ditampilkan.
- `submittedBy` bernilai `null` jika tiket dikirim sendiri oleh pemohon.
- `url` membuka tiket di iDesk untuk pemohon. Pakai ini untuk tombol "Buka di iDesk".

### Endpoint

| Endpoint | Keterangan |
|---|---|
| `GET /tickets/{ticketNumber}` | Satu tiket |
| `GET /tickets?externalRef=EBBK-BBK_2600064552` | Cari dari ID Anda sendiri |
| `GET /tickets?nik=00061001&state=open` | Tiket milik NIK itu yang dibuat aplikasi ini, terbaru dulu, maksimal 100. Untuk riwayat lengkap gunakan `state=all`. |

---

## 6. Chat tiket

### 6.1 Membaca: `GET /tickets/{ticketNumber}/messages`

200 pesan publik terakhir, dari yang terlama. Catatan internal tidak pernah ikut.

```json
{
  "ticketNumber": "241026-FIN-0003",
  "url": "https://idesk.santos.co.id/client/tickets/…",
  "messages": [
    { "id": "…", "sender": { "name": "Sari Dewi" }, "fromRequester": true,
      "content": "Approve dari saya seharusnya masuk ke Manager Finance…", "attachments": [], "createdAt": "…" },
    { "id": "…", "sender": { "name": "Agent Web" }, "fromRequester": false,
      "content": "Sudah kami cek, flow approval diperbaiki.", "attachments": [ { "name": "flow.pdf" } ], "createdAt": "…" }
  ]
}
```

### 6.2 Membalas: `POST /tickets/{ticketNumber}/messages`

```json
{ "nik": "00061001", "content": "Terima kasih, sudah saya coba dan berhasil." }
```

- Boleh dikirim oleh **pemohon, pengirim (`submittedBy`), anggota tiket, atau agen yang menangani**. Orang lain mendapat `403`.
- Teks biasa, maksimal 4000 karakter. Tiket yang sudah ditutup menghasilkan `400`.
- Pesan masuk ke chat iDesk seperti diketik di iDesk: notifikasi, status, dan SLA ikut berjalan.
- Respons `201`: `{ "id": "…", "createdAt": "…" }`.

---

## 7. Webhook (iDesk → aplikasi Anda)

Jika admin mengisi **URL webhook**, iDesk mengirim `POST` ke URL itu setiap ada perubahan pada tiket yang dibuat aplikasi Anda. Header-nya sama (`x-idesk-client-id`, `x-idesk-timestamp`, `x-idesk-signature`) dan ditandatangani dengan secret yang sama. **Verifikasi tanda tangan dan timestamp** sebelum memproses, lalu balas `2xx` secepatnya.

```json
{
  "id": "4f0c6a1e-…",
  "event": "ticket.status_changed",
  "occurredAt": "2026-10-24T03:10:00.000Z",
  "previousStatus": "TODO",
  "ticket": { "...": "bentuk sama dengan bagian 5" }
}
```

| `event` | Kapan | Field tambahan |
|---|---|---|
| `ticket.created` | Tiket dibuat | – |
| `ticket.assigned` | PIC berganti | `previousAssignee` |
| `ticket.status_changed` | Status berubah | `previousStatus` |
| `ticket.resolved` | Selesai, menunggu konfirmasi pemohon | `previousStatus` |
| `ticket.closed` | Ditutup | `previousStatus` |
| `ticket.message_created` | Ada balasan publik baru | `message` (preview ≤ 100 karakter), `recipients` (`[{ "nik": "…" }]`, yaitu pihak yang perlu diberi tahu) |
| `ticket.read` | Seseorang membuka tiket di iDesk | `reader` (`{ "nik": "…" }`), bisa dipakai untuk menghapus badge notifikasi |

- Pengiriman **at-least-once**: event yang sama bisa datang dua kali, jadi abaikan `id` yang sudah diproses.
- Jika gagal (bukan 2xx, atau lebih dari 10 detik), iDesk mencoba lagi setelah 1 menit, 5 menit, 30 menit, dan 2 jam. Setelah itu event dibuang; gunakan `GET /tickets` untuk sinkron ulang.
- Untuk satu tiket, event dikirim sesuai urutan kejadian.

### Contoh penerima (Node.js / Express)

```js
import { createHmac, timingSafeEqual } from 'crypto';

const sameSignature = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

app.post('/api/idesk/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const body = req.body.toString('utf8');               // teks mentah, jangan di-parse dulu
  const ts = req.get('x-idesk-timestamp');
  const expected = createHmac('sha256', process.env.IDESK_SECRET).update(`${ts}.${body}`).digest('hex');
  const fresh = Math.abs(Date.now() - Number(ts)) < 5 * 60_000;
  if (!fresh || !sameSignature(expected, req.get('x-idesk-signature') ?? '')) {
    return res.sendStatus(401);
  }
  const evt = JSON.parse(body);
  // TODO: lewati jika evt.id sudah pernah diproses; cari tiket Anda lewat evt.ticket.externalRef
  res.sendStatus(200);
});
```

---

## 8. Kode error

| Kode | Arti | Penyebab umum |
|---|---|---|
| `400` | Request tidak valid | Field kurang atau terlalu panjang, modul/kategori salah, tiket sudah ditutup (saat membalas) |
| `401` | Tidak terautentikasi | Header kurang, secret salah atau sudah diganti, jam server melenceng lebih dari 5 menit, body berubah setelah ditandatangani, aplikasi dinonaktifkan |
| `403` | Tidak diizinkan | Fitur belum dicentang admin, modul tidak diizinkan, atau NIK bukan pihak tiket (saat membalas) |
| `404` | Tidak ditemukan | Tiket tidak ada, atau bukan tiket yang dibuat aplikasi ini |
| `422` | NIK tidak dikenali | NIK belum terdaftar atau tidak aktif di iDesk |
| `429` | Terlalu banyak request | Lebih dari 120 request per menit; tunggu lalu coba lagi |

Isi error selalu berbentuk JSON: `{ "statusCode": 403, "message": "This app may not file tickets into module \"it-support\"" }`.

---

## 9. Checklist sebelum go-live

- [ ] Admin iDesk sudah mendaftarkan aplikasi dengan modul dan fitur yang tepat, dan secret tersimpan di konfigurasi server.
- [ ] `GET /me` berhasil dari server produksi, sehingga jam server sudah sinkron NTP.
- [ ] `externalRef` diambil dari ID unik di aplikasi Anda, dan retry setelah timeout memakai nilai yang sama.
- [ ] NIK diambil dari data HRIS, bukan diketik manual oleh user.
- [ ] Error `422` dan `403` ditampilkan dengan pesan yang dimengerti user.
- [ ] Webhook memverifikasi tanda tangan, mengabaikan `id` ganda, dan membalas `2xx` di bawah 10 detik.
- [ ] Tombol "Buka di iDesk" memakai `ticket.url`.
