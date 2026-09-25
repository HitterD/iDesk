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
