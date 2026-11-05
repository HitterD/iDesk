# Device heartbeat — nama komputer & IP pemohon

Agent/admin melihat **komputer** dan **IP** pemohon di panel **Pemohon** pada halaman detail tiket
(di bawah email). Data ini **tidak pernah** terlihat oleh pemohon, peserta tiket, atau tim lain
(`GET /tickets/:id/requester-device` mengembalikan 403 untuk mereka, dan kolomnya `select: false`
di entity sehingga tidak ikut di endpoint tiket lain).

Browser tidak bisa membaca nama komputer, jadi iDesk memakai dua sumber:

| Urutan | Sumber | Isi `requesterHostnameSource` | Syarat |
|---|---|---|---|
| 1 | **Heartbeat aplikasi desktop** (iPop notifier) dalam 15 menit terakhir | `AGENT` | Aplikasi terpasang & login dengan JWT iDesk (bagian 1–3) |
| 2 | **Reverse DNS** (PTR) dari IP request | `RDNS` | DNS kantor + jaringan (bagian 4) |
| — | Tidak ada keduanya | `null`, tampil `—` | IP tetap tercatat |

Snapshot diambil **saat tiket dibuat**, hanya jika pemohon membuat tiket sendiri (tiket yang dibuat
agent "atas nama user lain" tidak dicatat, karena PC-nya PC agent). Pencarian ini tidak pernah
menggagalkan atau memperlambat pembuatan tiket lebih dari ±1,5 detik.

---

## 1. Endpoint heartbeat (untuk developer iPop notifier)

```
POST {IdeskServerUrl}/api/v1/devices/heartbeat
Authorization: Bearer <JWT iDesk milik user yang sedang login>
Content-Type: application/json
```

> **Penting:** token harus **JWT iDesk** (yang sama dengan cookie `access_token` setelah login iDesk),
> bukan token server SJA/Keycloak. Token selain itu → `401`.

### Body

| Field | Wajib | Tipe / batas | Contoh | Sumber di C# |
|---|---|---|---|---|
| `hostname` | ya | maks 253, huruf/angka/`.`/`-`, diawali huruf/angka | `SJA-FIN-PC012` | `Environment.MachineName` |
| `lanIp` | tidak | IPv4/IPv6 valid | `10.10.6.45` | IP adapter aktif (lihat contoh) |
| `windowsUser` | tidak | maks 100 | `SJA\ervina` | `$"{Environment.UserDomainName}\\{Environment.UserName}"` |
| `osVersion` | tidak | maks 100 | `Windows 11 Pro (10.0.22631)` | `RuntimeInformation.OSDescription` |
| `appVersion` | tidak | maks 30 | `2.4.0` | versi assembly aplikasi |

Field lain → `400` (server memakai `forbidNonWhitelisted`).
Jika `lanIp` kosong, iDesk memakai IP yang terlihat dari request.

### Response

| Status | Arti | Tindakan aplikasi |
|---|---|---|
| `200 {"ok":true}` | tersimpan | — |
| `400` | body tidak valid (mis. hostname berisi spasi) | log, jangan retry dengan body yang sama |
| `401` | token kosong/kedaluwarsa/bukan JWT iDesk | minta login ulang / refresh token |
| `429` | lebih dari 6 request per menit | tunggu interval berikutnya |
| `5xx` / timeout | server bermasalah | coba lagi di interval berikutnya |

Heartbeat disimpan per **(user, hostname)**; mengirim ulang hanya memperbarui `lastSeenAt`.

### Kapan dikirim

1. Segera setelah user login di aplikasi.
2. Lalu **setiap 5 menit** selama aplikasi berjalan (dan saat PC bangun dari sleep / jaringan berubah).

Heartbeat dianggap "sedang dipakai" selama 15 menit, jadi interval 5 menit memberi toleransi dua kali gagal.
Jika ada beberapa heartbeat segar, iDesk memilih yang `lanIp`-nya sama dengan IP request tiket.

### Contoh C# (.NET 6+)

```csharp
using System.Net.Http.Json;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;

static string? GetLanIp()
{
    // Adapter yang aktif dan punya gateway = jaringan yang benar-benar dipakai.
    return NetworkInterface.GetAllNetworkInterfaces()
        .Where(n => n.OperationalStatus == OperationalStatus.Up
                 && n.NetworkInterfaceType != NetworkInterfaceType.Loopback
                 && n.GetIPProperties().GatewayAddresses.Any())
        .SelectMany(n => n.GetIPProperties().UnicastAddresses)
        .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork)
        .Select(a => a.Address.ToString())
        .FirstOrDefault();
}

static async Task SendHeartbeatAsync(HttpClient http, string ideskBaseUrl, string ideskJwt, string appVersion, CancellationToken ct)
{
    using var request = new HttpRequestMessage(HttpMethod.Post, $"{ideskBaseUrl.TrimEnd('/')}/api/v1/devices/heartbeat")
    {
        Content = JsonContent.Create(new
        {
            hostname = Environment.MachineName,
            lanIp = GetLanIp(),
            windowsUser = $"{Environment.UserDomainName}\\{Environment.UserName}",
            osVersion = RuntimeInformation.OSDescription,
            appVersion,
        }),
    };
    request.Headers.Authorization = new("Bearer", ideskJwt);

    using var response = await http.SendAsync(request, ct);
    if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
    {
        // token iDesk habis: minta login ulang, jangan spam retry
    }
}

// Timer: kirim saat login lalu tiap 5 menit.
// var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
// await SendHeartbeatAsync(...); while (await timer.WaitForNextTickAsync(ct)) await SendHeartbeatAsync(...);
```

### Uji manual

```bash
curl -i -X POST https://idesk.santos.co.id/api/v1/devices/heartbeat \
  -H "Authorization: Bearer $IDESK_JWT" -H "Content-Type: application/json" \
  -d '{"hostname":"SJA-FIN-PC012","lanIp":"10.10.6.45"}'
```

Lalu buat tiket dari akun yang sama dalam 15 menit. Di halaman tiket (sebagai agent) panel **Pemohon** menampilkan
`Komputer: SJA-FIN-PC012`. Arahkan kursor ke nama komputer untuk melihat sumbernya dan perangkat lain user itu.

---

## 2. Data yang disimpan

- `tickets.requesterIp`, `tickets.requesterHostname`, `tickets.requesterHostnameSource`: snapshot saat tiket dibuat.
- Tabel `user_devices`: satu baris per (user, hostname), dihapus otomatis bila user dihapus.
- Ditampilkan ke agent: komputer + IP tiket, dan maksimal 3 perangkat terakhir user (tooltip).

---

## 3. Checklist rilis aplikasi desktop

- [ ] Aplikasi menyimpan **JWT iDesk** user (bukan hanya token SJA) dan bisa memperbaruinya.
- [ ] Heartbeat dikirim saat login + tiap 5 menit + saat resume/ganti jaringan.
- [ ] `401` → minta login ulang; error lain → diam, coba di interval berikutnya.
- [ ] Tidak mengirim data selain field di tabel bagian 1.

---

## 4. Fallback reverse DNS (tanpa aplikasi desktop) — checklist infra

Reverse DNS **tidak butuh akun AD**. Yang dibutuhkan:

1. **Reverse Lookup Zone** di DNS Server (DC) untuk setiap subnet kantor,
   mis. `10.10.6.0/24` → zone `6.10.10.in-addr.arpa`.
2. **DHCP → IPv4 → Properties → DNS**: centang *Enable DNS dynamic updates* → *Always dynamically update
   DNS records*, dan *Discard A and PTR records when lease is deleted*.
3. **DNS Scavenging** aktif (mis. 7 hari) agar PTR untuk IP yang sudah pindah tangan tidak menunjuk ke PC lama.
4. **Container backend memakai DNS kantor.** Di compose Coolify, service backend:
   ```yaml
   dns:
     - <IP DC 1>
     - <IP DC 2>
   ```
   Compose produksi tidak terhubung ke repo, jadi tempel manual di Coolify. Buka firewall UDP/TCP 53 dari server iDesk ke DC.
5. **IP asli user sampai ke backend.** Proxy (Traefik/Nginx/Synology) harus meneruskan `X-Forwarded-For`.
   Cek di audit log: IP login user harus beragam (`10.10.x.x`), bukan satu IP gateway yang sama.
6. Uji dari container backend: `node -e "require('dns').promises.reverse('10.10.6.45').then(console.log)"`.

Reverse DNS hanya dicoba untuk IP privat (10/8, 172.16/12, 192.168/16, fc00::/7). IP publik (user dari luar
kantor/VPN NAT) hanya dicatat IP-nya.

Matikan fallback bila server tidak bisa menjangkau DNS kantor (menghindari timeout 1,5 detik per tiket):

```
REQUESTER_RDNS_ENABLED=false
```

---

## 5. Opsional nanti: detail dari Active Directory (LDAP)

Belum dipakai. Hanya diperlukan bila ingin menampilkan OS, OU, deskripsi, atau `lastLogon` objek **Computer**
berdasarkan hostname. AD **tidak** bisa menjawab "user X sedang login di PC mana", jadi heartbeat tetap diperlukan.

Kebutuhan jika diaktifkan:

| Item | Keterangan |
|---|---|
| Service account | user domain biasa, **read-only**, password tidak kedaluwarsa (mis. `svc-idesk-ldap`) |
| Koneksi | **LDAPS port 636** dari server iDesk ke DC (sertifikat DC dipercaya container) |
| Base DN | mis. `DC=sja,DC=com` (atau OU komputer: `OU=Computers,DC=sja,DC=com`) |
| Atribut dibaca | `cn`, `dNSHostName`, `operatingSystem`, `operatingSystemVersion`, `description`, `lastLogonTimestamp`, `distinguishedName` |
| Penyimpanan kredensial | env di Coolify (`LDAP_URL`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_BASE_DN`), **tidak** di repo |
