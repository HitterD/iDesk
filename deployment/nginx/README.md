# Panduan Setup Nginx / Nginx Proxy Manager (NPM) untuk iDesk

Panduan ini mengatur reverse proxy agar domain internal/eksternal **`idesk.santos.co.id`** mengarah ke server Production iDesk di Coolify.

---

## Arsitektur Koneksi
```text
Browser Client
     │
     ▼
Nginx Proxy Manager (NPM) / Nginx Host
     │
     ▼ (Forward ke IP Coolify:Port Frontend)
http://192.168.2.136:3080
     │
     ├──> [Frontend Nginx Container] (Port 8080) -> Melayani Vue/React SPA
     └──> [Backend NestJS Container] (Port 5050) -> Otomatis di-proxy via /v1, /api/v1, /socket.io
```

---

## Opsi A: Setup Menggunakan Nginx Proxy Manager (NPM GUI)

1. Buka dashboard Nginx Proxy Manager.
2. Masuk ke menu **Hosts** > **Proxy Hosts** > **Add Proxy Host**.
3. **Tab Details:**
   - **Domain Names:** `idesk.santos.co.id`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `192.168.2.136`
   - **Forward Port:** `3080`
   - **Cache Assets:** `OFF`
   - **Block Common Exploits:** `ON`
   - **Websockets Support:** `ON` (Wajib aktif untuk Socket.io / notifikasi real-time)
4. **Tab SSL:**
   - Pilih sertifikat SSL perusahaan Anda (Wildcard `*.santos.co.id` atau Let's Encrypt).
   - Centang **Force SSL** dan **HTTP/2 Support**.
   - **Force SSL wajib ON**: notifikasi browser (Windows toast untuk chat tiket) hanya bisa aktif di HTTPS.
5. **Tab Advanced:**
   - Salin isi dari file `deployment/nginx/npm-advanced-snippet.txt` dan tempelkan ke kotak teks.
6. Klik **Save**.

---

## Opsi B: Setup Menggunakan Standalone Nginx (`nginx.conf`)

1. Salin file `idesk.santos.co.id.conf` ke folder konfigurasi Nginx server Anda:
   ```bash
   sudo cp idesk.santos.co.id.conf /etc/nginx/conf.d/
   ```
2. Sesuaikan sertifikat SSL jika menggunakan HTTPS.
3. Test konfigurasi:
   ```bash
   sudo nginx -t
   ```
4. Reload Nginx:
   ```bash
   sudo nginx -s reload
   ```

---

## Notifikasi Browser Wajib HTTPS

Browser hanya mengizinkan notifikasi (Web Push / Windows toast) di koneksi aman. User yang membuka iDesk lewat `http://192.168.2.136:3080` atau `http://idesk.santos.co.id` tidak akan pernah menerima notifikasi chat. Di halaman itu iDesk menampilkan banner yang mengarahkan ke `https://idesk.santos.co.id`.

- Pastikan `http://idesk.santos.co.id` di-redirect ke HTTPS (Force SSL di NPM, atau blok `listen 80` di `idesk.santos.co.id.conf`).
- Sebaiknya port `3080` di `192.168.2.136` hanya bisa diakses dari host NPM (firewall), supaya user tidak terbiasa membuka lewat IP.

### Kunci VAPID (sekali saja)

Web Push butuh pasangan kunci VAPID di environment backend (Coolify):

```bash
cd apps/backend && node scripts/generate-vapid-keys.js
```

Tempel hasilnya ke env backend di Coolify: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mis. `mailto:ict@santos.co.id`), lalu redeploy backend. Jangan pernah mengganti kunci setelah dipakai: semua browser harus mendaftar ulang.
