---
name: iDesk Design System
description: Round-2 iDesk helpdesk UI — sapphire chrome around a neutral content sheet, system font (SF on Apple / Inter elsewhere), sky-vs-navy status inks, one amber create CTA
colors:
  primary: "#2D4A8C"
  primary-dark: "hsl(221 56% 63%)"
  chrome: "hsl(222 52% 28%)"
  chrome-dark: "hsl(223 44% 13%)"
  accent: "hsl(39 92% 52%)"
  neutral-bg: "hsl(240 11% 96%)"
  neutral-bg-dark: "hsl(240 4% 9%)"
  card-bg: "hsl(0 0% 100%)"
  card-bg-dark: "hsl(240 5% 13%)"
  secondary: "hsl(240 25% 98%)"
  muted: "hsl(240 4% 39%)"
  border: "hsl(220 15% 85%)"
  border-dark: "hsl(223 15% 30%)"
  destructive: "#C4281C"
  status-open: "#0B6BB8"
  status-open-dark: "#7CC6FF"
  status-in-progress: "#2D4A8C"
  status-in-progress-dark: "#A9BDF0"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "1.15"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: "1.45"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "1.45"
  mono:
    fontFamily: "SF Mono, ui-monospace, JetBrains Mono, Cascadia Mono, monospace"
    fontSize: "11.5px"
    fontWeight: 550
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  2xl: "22px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 14px (height 32px; 40px on coarse pointer)"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, {colors.primary} 88%, #000)"
  button-cta:
    backgroundColor: "linear-gradient(180deg, hsl(39 96% 60%), {colors.accent})"
    textColor: "hsl(39 100% 12%)"
    rounded: "{rounded.full}"
  card-bento:
    backgroundColor: "{colors.card-bg}"
    rounded: "{rounded.xl}"
    padding: "14px 16px"
---

# Design System: iDesk (round 2, sebagaimana diimplementasikan)

Dokumen ini mendeskripsikan sistem yang **sudah dibangun** di `apps/frontend` pada branch `HitterD/redesign-mockup` (round 2, disetujui user 2026-10-21). Sumber kebenaran, bila ada perbedaan, selalu kode:

| Area | File |
|---|---|
| Token warna, font, motion | `apps/frontend/src/styles/tokens.css` |
| Shell, pill, tombol aksi, chat, press-scale, reduced motion | `apps/frontend/src/index.css` |
| Komponen dasar | `components/ui/button.tsx`, `segmented-control.tsx`, `ticket-pill.tsx`, `searchable-picker.tsx` |
| Halaman sumber daya (hardware, eform, zoom, KB) | `components/resources/ResourceParts.tsx` + `resources.css` |
| Halaman manajemen/admin/settings | `components/management/MgmtParts.tsx` + `management.css` |
| Dashboard | `features/dashboard/components/DashboardParts.tsx` + `dashboard.css` |
| Keputusan mockup yang mengikat | `docs/mockups/README.md` § "Keputusan round 2" |

Yang **tidak lagi berlaku** dari versi dokumen sebelumnya: font Plus Jakarta Sans, kanvas "warm ivory" sebagai latar halaman kerja, press `scale(0.97)` pada semua tombol, glassmorphism topbar. Token lama (`--background`, `--card`, `--primary` warm ivory/sapphire di `tokens.css`) masih ada untuk layar lama yang belum dipindah ke kosakata round 2 (mis. login, overlay shadcn); halaman round 2 memakai token `--idesk-*` dan `--ticket-*`.

## Overview

Agen dan admin bekerja di dalam **chrome sapphire** yang menyatu (sidebar + topbar, `.idesk-shell`), dengan konten di atas **sheet** netral bersudut `22px` kiri-atas (`.idesk-sheet`; mobile `18px 18px 0 0`). Pemohon (USER) memakai chrome yang sama sebagai pita atas tanpa sidebar (`ClientTopbar` + segmen tab). Isi halaman disusun dari panel putih tanpa border keras, bayangan setipis rambut, angka besar tabular, dan pill/bubble berwarna lembut. Satu-satunya warna "berteriak" adalah amber pada CTA "Buat Tiket Baru".

## Colors

### Chrome & permukaan (`--idesk-*`, HSL channel)
| Token | Light | Dark |
|---|---|---|
| `--idesk-sapphire` (aksen utama, fokus, primary) | `#2D4A8C` | `221 56% 63%` |
| `--idesk-chrome` → `--idesk-chrome-raised` (gradien shell) | `222 52% 28%` → sapphire | `223 44% 13%` → `221 44% 18%` |
| `--idesk-canvas` (sheet) | `240 11% 96%` | `240 4% 9%` |
| `--idesk-surface` (panel) | `0 0% 100%` | `240 5% 13%` |
| `--idesk-surface-raised` | `240 25% 98%` | `240 4% 15%` |
| `--idesk-text` / `--idesk-text-secondary` | `240 3% 12%` / `240 4% 39%` | `240 8% 95%` / `240 5% 72%` |
| `--idesk-border` | `220 15% 85%` | `223 15% 30%` |
| `--idesk-selection` | `221 50% 94%` | `221 35% 24%` |
| `--idesk-cta` / hover / foreground | `39 92% 52%` / `39 96% 60%` / `39 100% 12%` | sama |

Teks di chrome: `--idesk-chrome-foreground` (putih) dan `--idesk-chrome-muted`. `.idesk-shell` sengaja tetap memakai `--foreground` supaya overlay (palette, toast) tidak mewarisi teks putih; hanya `.idesk-sidebar`, `.idesk-topbar`, `.idesk-shell-chrome` yang memakai teks chrome.

### Tone tiket (`--ticket-*`, dipakai pill, picker, stat card)
Setiap tone punya `hue` (isi/garis, dicampur `--ticket-tint` 9% / dark 16%) dan `ink` (teks):

| Tone | Hue | Ink light | Ink dark |
|---|---|---|---|
| neutral | `240 2% 56%` | `240 4% 39%` | `240 5% 76%` |
| blue | `221 50% 48%` | `221 54% 36%` | `220 78% 77%` |
| **sky** (Open/TODO) | `#1A8FE0` (dark `#4FB3FF`) | **`#0B6BB8`** | **`#7CC6FF`** |
| **navy** (In Progress) | `#2D4A8C` | **`#2D4A8C`** | **`#A9BDF0`** |
| amber | `35 90% 50%` | `33 100% 29%` | `36 100% 68%` |
| green | `135 58% 44%` | `136 63% 27%` | `136 59% 65%` |
| red | `4 86% 58%` | `4 75% 40%` | `4 100% 74%` |
| teal | `178 81% 31%` | `178 80% 24%` | `178 62% 65%` |

Pemetaan resmi ada di `ticket-pill.tsx`:
- `STATUS_TONES`: TODO→sky, IN_PROGRESS→navy, WAITING_VENDOR→amber, RESOLVED→green, CLOSED→neutral, CANCELLED→red.
- `PRIORITY_TONES`: LOW→neutral, MEDIUM→blue, HIGH→amber, CRITICAL→red, HARDWARE_INSTALLATION→amber, ORACLE_REQUEST→blue.

Dashboard memakai palet hex sendiri yang selaras (`dashboard.css`: `--dash-blue #3d63b8`, `--dash-green #2fb350`, `--dash-orange #f2930d`, `--dash-red #f04438`, `--dash-teal`, `--dash-brown`, `--dash-navy`, `--dash-sky`, plus ink merah/hijau/oranye light+dark).

### Named Rules
- **Open ≠ In Progress.** Teks status Open (sky `#0B6BB8` / dark `#7CC6FF`) dan In Progress (navy `#2D4A8C` / dark `#A9BDF0`) wajib terbaca berbeda di semua permukaan (permintaan eksplisit user saat approval).
- **No purple.** Tidak ada ungu/indigo/magenta di tile, avatar, badge, chart, atau status. Palet `UserAvatar` dan badge iPop sudah dibersihkan. Sisa yang diketahui: `--glow-2` (hue 280, glow login sangat tipis) dan `InAppNotificationToast` TICKET_ASSIGNED (minor yang ditunda, lihat verification record).
- **Amber hanya untuk create.** Gradien amber `.idesk-cta` dipakai **hanya** oleh "Buat Tiket Baru" (topbar desktop, FAB mobile) dan tombol submit form create (`.idesk-cta.ct-submit`). Mode internal note memakai amber-soft (`--td-amber-soft`) sebagai latar, bukan tombol.
- **Destruktif** solid `#C4281C` (hover `#A82015`) hanya muncul di dalam dialog konfirmasi.

## Typography

- **Sans:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", system-ui, sans-serif` (`--font-sans`). Perangkat Apple memakai SF bawaan sistem; SF **tidak** di-self-host (lisensi Apple). Inter variable `wght@400..800` dimuat dari Google Fonts di `index.html` dengan `display=swap`.
- **Display:** `--font-display` (SF Pro Display/Inter) untuk judul halaman dan angka stat.
- **Mono:** `"SF Mono", ui-monospace, "JetBrains Mono", "Cascadia Mono", monospace` (`--font-mono`) untuk nomor tiket, ID, kode.
- `body { font-feature-settings: "cv11", "ss01" }` (alternatif Inter; diabaikan SF).

Skala yang dipakai halaman round 2 (bukan skala `--text-display-*` lama):
- Judul halaman `h1`: 700 24px/1.15, `letter-spacing: -.025em` (`.dash-head h1`).
- Judul panel `h3`: 650 13px.
- Body halaman: 13px/1.45; teks sekunder 12px `--td-text-3`.
- Angka stat (`.portal-stat-value`): 650 22px, `tabular-nums`, `-.03em`.
- Pill: 550 12px/18px; bubble mono 550 11.5px.

## Layout

- Desktop (≥1024px / Tailwind `lg`): sidebar chrome + topbar chrome + sheet. Sidebar bisa collapse (Ctrl+B); tab aktif "menyatu" ke sheet dengan kurva cekung dan meluncur dari item sebelumnya.
- Mobile (<1024px): tanpa sidebar; `MobileBottomNav` (agen) / `ClientBottomNav` (pemohon) di bawah dengan FAB amber terangkat di tengah. Tab pemohon icon-only di bawah `xl`.
- Konten dashboard: `.dash` max 1480px, grid 12 kolom `.dgrid` gap 12px, baris stat `.dash-stats.is-four/is-five`.
- Halaman sumber daya/manajemen: `ResHead` (tile + judul + aksi), baris stat `.res-stats.is-three…is-six`, lalu `ResTable` (radius 20px). Tabel memakai container query; di bawah ±1100px antrian berganti ke kartu dengan toolbar `Urutkan + Pilih semua`.
- Target: tidak ada overflow horizontal pada 390px.

## Elevation & Depth

Kedalaman dari kontras permukaan (canvas → surface) dan bayangan hairline, bukan border tebal:
- Diam: `--dash-shadow-1` = `0 1px 2px rgb(0 0 0/.04), 0 0 0 .5px rgb(0 0 0/.07)` (dark: hanya ring `.5px` putih 7%).
- Hover/terangkat: `--dash-shadow-2` = `0 10px 30px -12px rgb(0 0 0/.16), 0 0 0 .5px …`.
- Popover/picker: radius 16px, `0 14px 38px -12px hsl(220 55% 15%/.28)`, tanpa backdrop blur.
- Dialog: backdrop blur-in + konten spring-in.

## Shapes

- Kontrol (tombol aksi): 10px; tombol `is-lg` 12px.
- Panel / stat card: 18px; tabel sumber daya 20px; sheet 22px.
- Tile ikon nav: 22px kotak radius 7px (varian primary 26/8, collapsed 30/9).
- Pill, bubble, CTA amber, FAB: pill penuh / bulat.
- Chat bubble: 18px.

## Components

### Tombol (`components/ui/button.tsx`)
Varian round 2 (kelas `.idesk-btn`), tinggi 32px (40px pada `pointer: coarse`), radius 10px, ikon 16px stroke 1.9, jarak ikon-label 6px, fokus ring 3px sapphire 38%:
- `primary` — sapphire solid. **Tepat satu per permukaan** (mis. Resolve / "Masalah sudah selesai").
- `soft` (default) — surface + ring border, ikon + label (sekunder).
- `subtle` — ghost transparan (tersier); ikon-saja wajib `aria-label` + tooltip.
- `danger` — teks merah lembut; aksinya selalu lewat konfirmasi yang memakai `danger-solid`.
- `loading` → `aria-busy` + spinner `.idesk-spin`, tombol disabled. Disabled: opacity .5, tanpa press.
Varian lama (`default/destructive/outline/secondary/ghost/link`) tetap ada untuk layar yang belum dimigrasi.

### CTA "Buat Tiket Baru" (`.idesk-cta`)
Gradien amber, teks amber gelap, ikon plus dalam lingkaran putih 55%. **Tepat satu yang terlihat per viewport:** topbar (`BentoTopbar`, `ClientTopbar` `hidden lg:inline-flex`) di desktop, FAB `.idesk-fab` 50px di bottom nav mobile. Tidak ada tombol create di header antrian, menu tiket, sidebar, atau command palette. Entry point sekunder (help banner pemohon, empty state) memakai tautan teks sapphire `.idesk-text-link` "Buat tiket →". Path tujuan role-aware (`getCreateTicketPath`).

### Segmented control (`segmented-control.tsx`)
Grup tombol `aria-pressed` dengan satu thumb yang meluncur (`--dur-3`). Segmen bisa berupa tautan (`href`) — dipakai untuk toggle **Kanban | Tabel**: klik biasa menunggu thumb tiba lalu navigasi; klik termodifikasi tetap perilaku tautan native. Panah kiri/kanan berpindah segmen. Dipakai ulang sebagai `DashSeg`, `MgTabs`, mode composer Public Reply / Internal Note.

### Pill & bubble
- `TicketPill` (`.ticket-pill.ticket-tone-*`): nilai **read-only** (status, prioritas). 26px tinggi, isi tone 9%, border tone 24%, teks ink.
- Nilai yang bisa diedit memakai `SearchablePicker` dengan trigger `.picker-trigger` berbentuk pill yang sama (hover isi 15%); panel cmdk mencari hanya label/description (bukan ID mentah), opsi 38px (44px coarse).
- `DashBub` / `ResBub` (`.dash-bub`): bubble 26px warna bebas lewat `--c`/`--ink` untuk kategori, sumber, peran, waktu; varian `mono`, `is-btn`, `is-plain`.
- Chat: `.chat-bubble-in` surface + hairline; `.chat-bubble-out` sapphire solid teks putih (dark `hsl(221 48% 42%)`); internal note amber-soft + ikon gembok. Reaksi `.chat-react` chip di bawah bubble; toolbar `.chat-tools` muncul saat hover/focus (touch: tahan).

### Stat card
Satu grammar untuk antrian, portal, dashboard, sumber daya, manajemen (`queue-stat`, `portal-stat`, `DashStat`, `ResStat`, `MgStat`): ikon bubble kiri-atas, angka kanan-atas, label, baris sub opsional. `is-attn`/`is-attention` = isi tone 11% + angka ink (Overdue, Lewat SLA); `is-zero` = angka abu; `is-active` = ring tone (filter aktif). Yang bisa diklik naik `-2px` saat hover dan `translateY(0) scale(.98)` saat ditekan; yang statis (`.res-stat-static`) tidak bergerak.

### Panel
`DashPanel` / `.dash-panel`: surface, radius 18px, padding 14px 16px, `--dash-shadow-1`, `h3` 13px/650 dengan slot kanan untuk segmen atau status `Live/Offline`. `MgPanel` membungkus isi tab manajemen dengan arah slide sesuai urutan tab (`useTabDirection`). `MgBanner` untuk status ok/warn di System Health. Jangan menumpuk panel di dalam panel.

### Input & form
Field create ticket memakai segmen urgensi, picker kategori/perangkat/aplikasi, counter karakter di luar `<label>` (agar tidak mencemari accessible name), dan submit amber `.idesk-cta.ct-submit` yang disabled sampai valid.

## Motion

Token (`tokens.css`): `--ease-out: cubic-bezier(.22,1,.36,1)`, `--ease-spring: cubic-bezier(.34,1.36,.64,1)`, `--dur-1: 120ms`, `--dur-2: 200ms`, `--dur-3: 280ms`. Semua transisi round 2 membaca token ini.

Inventaris: konten halaman fade+rise saat ganti route (`.idesk-page-enter`); item sidebar press `scale(.98)` (kecuali tab aktif) dan tab aktif meluncur; popover Radix tumbuh dari trigger (`--radix-popper-transform-origin`); dialog spring-in + backdrop blur; stat card lift; baris tabel tint; thumb segmented meluncur; bulk bar slide-up; pesan chat masuk berurutan; reaksi pop; kartu Kanban lift/ghost/placeholder/landing.

**Press feedback global** (`index.css:39-43`): `button:active, [role="button"]:active { transform: scale(0.96) }`.

**Larangan press-scale pada stretched target (UAT-1 B1).** Hit target yang membentang di atas (atau berisi) konten lain tidak boleh di-scale: hit box yang mengecil memindahkan `pointerup` ke elemen lain sehingga klik jatuh ke ancestor (bug produksi: kartu katalog tidak bisa diklik). Pengecualian unlayered di `index.css:44-61`: `.ct-link`, `[data-card-action]`, `[data-stretched]`, `.queue-row`, `.portal-row`, `.portal-help-banner`, `.queue-select-cell`, semua tombol di dalam baris antrian/portal/`res-row`, `button.dash-li`, akun/booking zoom, TOC/topik/artikel KB, switch, `.mg-notif*`, `button.mg-node`, `.mg-vtabs`, `.mg-theme-card`, `.mg-ccard`, `button.hl-kpi-btn`, `.mg-setting button`, `.set-avatar`. Komponen baru yang membentang **wajib** memakai `data-stretched` atau ditambahkan ke daftar ini; aturan pengecualian harus unlayered agar mengalahkan aturan global.

**Reduced motion** (`index.css`, blok terakhir, unlayered): `--dur-*` menjadi 0ms; semua animasi/transisi `.01ms`, iterasi 1; hover lift stat card/katalog dimatikan; spinner dan skeleton pulse berhenti. `SegmentedControl` membaca `--dur-3` sehingga thumb langsung pindah.

## Light / Dark

Mode gelap lewat kelas `.dark` di root; setiap token `--idesk-*`, `--ticket-*`, `--dash-*`, `--td-*` punya override dark di file yang sama. Chrome tetap gelap kebiruan, sheet menjadi `240 4% 9%`, panel `240 5% 13%`, bayangan diganti ring hairline putih. Ink tone diterangkan (lihat tabel) agar kontras teks pill tetap terbaca.

## Mobile

- Bottom nav fixed dengan blur, FAB amber 50px terangkat (`-top-3.5`) di tengah, label "Tiket Baru".
- Target sentuh minimal 40px untuk tombol aksi dan 44px untuk opsi picker (`pointer: coarse`).
- Aksi baris antrian (`⋯`) selalu tampil pada perangkat tanpa hover; header detail tiket memindahkan aksi sekunder ke menu "Aksi lainnya" lewat container query.
- Kanban: drag dengan tahan sentuh; alternatif tombol status di kartu.

## Do's and Don'ts

### Do
- Pakai `TicketPill` untuk status/prioritas read-only dan `SearchablePicker` untuk nilai yang bisa diedit — dengan `STATUS_TONES`/`PRIORITY_TONES`.
- Pakai token motion (`--dur-*`, `--ease-*`) untuk setiap transisi baru.
- Beri `data-stretched` (atau pengecualian unlayered) pada setiap hit target yang membentang.
- Pakai `.idesk-text-link` untuk entry point create sekunder.

### Don't
- Jangan menambah tombol amber kedua atau tombol "Buat Tiket" di header/menu/sidebar/palette.
- Jangan memakai ungu/indigo/magenta.
- Jangan menyamakan warna teks Open dan In Progress.
- Jangan men-scale baris, kartu stretched, atau tombol di dalam baris saat ditekan.
- Jangan memakai lebih dari satu `primary` per permukaan.
- Jangan menambah animasi tanpa memastikan blok reduced-motion ikut mematikannya.
