# Redesign Aplikasi Desktop SJA Notification Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyatukan tiga palet warisan menjadi satu set token adaptif, merapikan hierarki dan kepadatan seluruh permukaan aplikasi desktop, menyatukan History/Settings ke jendela utama, menyelaraskan tiga permukaan Remote, dan mengubah seluruh label antarmuka ke bahasa Inggris — tanpa mengubah perilaku notifikasi, autentikasi, izin, atau protokol remote.

**Architecture:** `FluentTheme.cs` menjadi satu-satunya sumber warna dan font; nama properti dipertahankan sehingga seluruh pemanggil ikut berubah tanpa disentuh. 84 literal `Color.FromArgb` di berkas form diganti token secara bertahap, satu berkas per task. Verifikasi visual memakai harness `--test-render-*` yang sudah ada di `Program.cs`, diperluas ke permukaan yang belum tercakup.

**Tech Stack:** .NET 10 (`net10.0-windows10.0.19041.0`), WinForms, GDI+ custom painting, xUnit 2.9.3.

**Spec:** `docs/superpowers/specs/2026-09-12-sja-notifier-desktop-redesign-design.md`

## Global Constraints

- **Target framework:** `net10.0-windows10.0.19041.0`. Jangan naikkan atau turunkan.
- **Jangan tambah dependensi NuGet.** Hanya `Microsoft.Toolkit.Uwp.Notifications` 7.1.3 dan referensi lokal `AxWMPLib`/`WMPLib` yang ada sekarang.
- **Tidak ada `Color.FromArgb` di berkas form.** Semua warna lewat properti `FluentTheme`. Satu-satunya berkas yang boleh memuat literal warna adalah `FluentTheme.cs`.
- **Tidak ada `new Font("...")` dengan nama family literal.** Gunakan `FluentTheme.GetFont(size, style)`.
- **Label antarmuka bahasa Inggris.** Isi notifikasi (judul, pesan, prioritas, pengirim) berasal dari server dan TIDAK diterjemahkan.
- **Tidak ada `.resx` / berkas sumber teks terpusat.** Label tetap literal di tempat konstruksinya.
- **Jangan ubah:** logika notifikasi (durasi, suara, kemunculan), autentikasi, `RemoteAccessPolicy.cs`, protokol remote (`RemoteHostEngine.cs`, P2P, relay WS, transfer file), hitungan mundur persetujuan otomatis di privacy overlay, `MessageBox` untuk galat sistem.
- **Skala sudut:** 6 / 8 / 10 / 12 / pil. **Jarak:** 4 / 8 / 12 / 16 / 20 / 24.
- **Baseline yang harus tetap hijau:** `dotnet build` sukses, 31 test xUnit lulus.
- **Setiap task berakhir dengan commit.** Pesan commit diakhiri:
  ```
  Co-Authored-By: Claude Code <noreply@anthropic.com>
  ```

**Perintah yang dipakai berulang** (dari root repo):

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
```

Render preview (dari direktori output build):

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app/bin/Debug/net10.0-windows10.0.19041.0"
./SJANotifier.exe --test-render-main dashboard light
```

---

## Struktur Berkas

Berkas yang ada sekarang dan tanggung jawabnya setelah redesign:

| Berkas | Baris sekarang | Tanggung jawab setelah redesign |
|---|---|---|
| `FluentTheme.cs` | 844 | **Satu-satunya** sumber warna, font, ikon vektor, util GDI+ |
| `ThemeTokens.cs` | *baru* | Konstanta nilai warna mentah terang/gelap (dipisah agar `FluentTheme.cs` tidak membengkak) |
| `MainWindowForm.cs` | 2189 | Kerangka jendela, titlebar, sidebar, peralihan halaman |
| `HomeControlPanel.cs` | *baru* | Halaman Home (tiga notifikasi terbaru + tombol lihat semua) |
| `AppDialogs.cs` | *baru* | Dialog konfirmasi beringkai aplikasi |
| `HistoryControlPanel.cs` | 496 | Halaman History |
| `SettingsControlPanel.cs` | 731 | Halaman Settings |
| `TrayApplicationContext.cs` | 951 | Menu tray |
| `GlassControls.cs` | 1099 | Kontrol kustom (tombol, dropdown, toggle, scrollbar) |
| `FluentMenuRenderer.cs` | 174 | Renderer `ToolStrip` |
| `NotificationPopupForm.cs` | 866 | Popup notifikasi |
| `RemoteDeviceBrowserForm.cs` | 758 | Daftar perangkat remote |
| `RemoteViewerForm.cs` | 841 | Jendela sesi remote |
| `RemotePrivacyOverlayForm.cs` | 499 | Pelindung privasi |
| `Program.cs` | 317 | Entry point + harness render |
| `HistoryForm.cs` | 526 | **Dihapus** (Task 12) |
| `SettingsForm.cs` | 238 | **Dihapus** (Task 12) |
| `LoginForm.cs` | 302 | **Dihapus** (Task 12) — kode mati |

`MainWindowForm.cs` sudah 2189 baris, jauh di atas batas 800 baris CLAUDE.md §4. Task 8 memindahkan halaman Home ke `HomeControlPanel.cs` (sejajar dengan `HistoryControlPanel`/`SettingsControlPanel` yang sudah ada), yang menurunkannya secara berarti. Pemecahan lebih jauh tidak dilakukan dalam rencana ini — itu refactor terpisah di luar cakupan redesign.

**Urutan penting:** Task 2 (harness) mendahului Task 12 (penghapusan form), karena `--test-render-settings` dan `--test-render-history` saat ini memakai `SettingsForm` (`Program.cs:190`) dan `HistoryForm` (`Program.cs:230`). Menghapus form lebih dulu akan merusak build.

---

## Task 1: Token warna terpusat

Mengganti tiga palet warisan dengan satu set token adaptif. Nama properti dipertahankan agar seluruh pemanggil ikut berubah tanpa disentuh.

**Files:**
- Create: `apps/sja-notification-app/ThemeTokens.cs`
- Modify: `apps/sja-notification-app/FluentTheme.cs:18-75` (blok token), `:136-173` (token adaptif), `:176-226` (token prioritas)
- Test: `apps/sja-notification-app-tests/ThemeTokenTests.cs`

**Interfaces:**
- Consumes: —
- Produces:
  - `static class ThemeTokens` dengan konstanta `Color` bernama (lihat Step 3).
  - `FluentTheme` properti adaptif (nama tidak berubah, hanya nilai): `ThemeCanvasTop`, `ThemeCanvasBottom`, `ThemeCardFill`, `ThemeCardFillSoft`, `ThemeCardHairline`, `ThemeCardHairlineStrong`, `ThemeCardHighlight`, `ThemeInputWell`, `ThemeInputBorder`, `ThemeTextPrimary`, `ThemeTextSecondary`, `ThemeTextMuted`, `ThemeAccent`, `ThemeAccentHover`, `ThemeAccentPressed`, `ThemeAccentSoft`, `ThemeAccentText`, `ThemeMenuBackground`, `ThemeMenuSurface`, `ThemeMenuHover`, `ThemeMenuSelected`, `ThemeMenuBorder`, `ThemeMenuBorderStrong`, `ThemeStatusOnlineBg`, `ThemeStatusOfflineBg` — semuanya `static Color { get; }`.
  - **Baru:** `static Color ThemeSidebar { get; }`, `static Color ThemeSurface { get; }`, `static Color ThemeSurfaceSoft { get; }`, `static Color ThemeHover { get; }`, `static Color ThemeStatusOnline { get; }`, `static Color ThemeStatusWarn { get; }`, `static Color ThemeStatusCritical { get; }`, `static Color ThemeStatusCriticalText { get; }`.
  - `GetPriorityTheme(string?)` dan `GetPriorityDisplayLabel(string?)` — tanda tangan tidak berubah.

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/sja-notification-app-tests/ThemeTokenTests.cs`:

```csharp
using System.Drawing;
using SJANotificationApp;
using Xunit;

namespace SJANotificationApp.Tests
{
    public class ThemeTokenTests
    {
        [Fact]
        public void LightTheme_UsesApplePalette()
        {
            FluentTheme.SetThemeOverride(false);

            Assert.Equal(Color.FromArgb(245, 245, 247), FluentTheme.ThemeCanvasTop);
            Assert.Equal(Color.FromArgb(29, 29, 31), FluentTheme.ThemeTextPrimary);
            Assert.Equal(Color.FromArgb(0, 113, 227), FluentTheme.ThemeAccent);

            FluentTheme.SetThemeOverride(null);
        }

        [Fact]
        public void DarkTheme_UsesApplePalette()
        {
            FluentTheme.SetThemeOverride(true);

            Assert.Equal(Color.FromArgb(28, 28, 30), FluentTheme.ThemeCanvasTop);
            Assert.Equal(Color.FromArgb(245, 245, 247), FluentTheme.ThemeTextPrimary);
            Assert.Equal(Color.FromArgb(10, 132, 255), FluentTheme.ThemeAccent);

            FluentTheme.SetThemeOverride(null);
        }

        [Fact]
        public void StatusTokens_AreThemeAware()
        {
            FluentTheme.SetThemeOverride(false);
            var lightOnline = FluentTheme.ThemeStatusOnline;
            var lightCritical = FluentTheme.ThemeStatusCritical;

            FluentTheme.SetThemeOverride(true);
            var darkOnline = FluentTheme.ThemeStatusOnline;
            var darkCritical = FluentTheme.ThemeStatusCritical;

            FluentTheme.SetThemeOverride(null);

            Assert.Equal(Color.FromArgb(36, 138, 61), lightOnline);
            Assert.Equal(Color.FromArgb(48, 209, 88), darkOnline);
            Assert.Equal(Color.FromArgb(201, 37, 45), lightCritical);
            Assert.Equal(Color.FromArgb(255, 105, 97), darkCritical);
        }

        [Theory]
        [InlineData("critical", "Blocker")]
        [InlineData("blocker", "Blocker")]
        [InlineData("high", "Urgent")]
        [InlineData("urgent", "Urgent")]
        [InlineData("low", "Low")]
        [InlineData("medium", "Normal")]
        [InlineData("normal", "Normal")]
        [InlineData(null, "INFO")]
        public void GetPriorityDisplayLabel_IsUnchanged(string? input, string expected)
        {
            Assert.Equal(expected, FluentTheme.GetPriorityDisplayLabel(input));
        }

        [Fact]
        public void GetPriorityTheme_UsesStatusTokensNotTailwind()
        {
            FluentTheme.SetThemeOverride(false);
            var urgent = FluentTheme.GetPriorityTheme("critical");
            FluentTheme.SetThemeOverride(null);

            // Tailwind red-600 (220,38,38) tidak boleh muncul lagi
            Assert.NotEqual(Color.FromArgb(220, 38, 38), urgent.Text);
            Assert.Equal(Color.FromArgb(201, 37, 45), urgent.Text);
        }
    }
}
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj --filter "FullyQualifiedName~ThemeTokenTests" -v q --nologo
```

Expected: FAIL — `ThemeStatusOnline` belum ada (compile error `CS0117`).

- [ ] **Step 3: Buat `ThemeTokens.cs`**

```csharp
using System.Drawing;

namespace SJANotificationApp
{
    /// <summary>
    /// Nilai warna mentah untuk tema terang dan gelap.
    /// Hanya dibaca oleh FluentTheme; berkas lain memakai properti FluentTheme.
    /// </summary>
    internal static class ThemeTokens
    {
        // ---- Terang ----
        internal static readonly Color LightCanvas = Color.FromArgb(245, 245, 247);
        internal static readonly Color LightCanvasBottom = Color.FromArgb(240, 240, 244);
        internal static readonly Color LightSidebar = Color.FromArgb(241, 241, 244);
        internal static readonly Color LightSurface = Color.FromArgb(255, 255, 255);
        internal static readonly Color LightSurfaceSoft = Color.FromArgb(250, 250, 250);
        internal static readonly Color LightWell = Color.FromArgb(242, 242, 245);
        internal static readonly Color LightHairline = Color.FromArgb(23, 0, 0, 0);
        internal static readonly Color LightHairlineStrong = Color.FromArgb(40, 0, 0, 0);
        internal static readonly Color LightHighlight = Color.FromArgb(175, 255, 255, 255);
        internal static readonly Color LightHover = Color.FromArgb(10, 0, 0, 0);
        internal static readonly Color LightInputBorder = Color.FromArgb(209, 209, 214);
        internal static readonly Color LightTextPrimary = Color.FromArgb(29, 29, 31);
        internal static readonly Color LightTextSecondary = Color.FromArgb(94, 94, 99);
        internal static readonly Color LightTextMuted = Color.FromArgb(142, 142, 147);
        internal static readonly Color LightAccent = Color.FromArgb(0, 113, 227);
        internal static readonly Color LightAccentHover = Color.FromArgb(0, 122, 255);
        internal static readonly Color LightAccentPressed = Color.FromArgb(0, 88, 176);
        internal static readonly Color LightAccentSoft = Color.FromArgb(235, 244, 255);
        internal static readonly Color LightOnline = Color.FromArgb(36, 138, 61);
        internal static readonly Color LightWarn = Color.FromArgb(178, 80, 0);
        internal static readonly Color LightCritical = Color.FromArgb(201, 37, 45);
        internal static readonly Color LightCriticalInk = Color.FromArgb(255, 255, 255);
        internal static readonly Color LightMenuBackground = Color.FromArgb(255, 255, 255);
        internal static readonly Color LightMenuSurface = Color.FromArgb(245, 245, 247);
        internal static readonly Color LightMenuHover = Color.FromArgb(235, 235, 240);
        internal static readonly Color LightMenuSelected = Color.FromArgb(224, 238, 255);
        internal static readonly Color LightMenuBorder = Color.FromArgb(229, 229, 234);
        internal static readonly Color LightMenuBorderStrong = Color.FromArgb(209, 209, 214);

        // ---- Gelap ----
        internal static readonly Color DarkCanvas = Color.FromArgb(28, 28, 30);
        internal static readonly Color DarkCanvasBottom = Color.FromArgb(22, 22, 24);
        internal static readonly Color DarkSidebar = Color.FromArgb(32, 32, 34);
        internal static readonly Color DarkSurface = Color.FromArgb(37, 37, 39);
        internal static readonly Color DarkSurfaceSoft = Color.FromArgb(43, 43, 46);
        internal static readonly Color DarkWell = Color.FromArgb(26, 26, 28);
        internal static readonly Color DarkHairline = Color.FromArgb(28, 255, 255, 255);
        internal static readonly Color DarkHairlineStrong = Color.FromArgb(48, 255, 255, 255);
        internal static readonly Color DarkHighlight = Color.FromArgb(28, 255, 255, 255);
        internal static readonly Color DarkHover = Color.FromArgb(18, 255, 255, 255);
        internal static readonly Color DarkInputBorder = Color.FromArgb(56, 56, 60);
        internal static readonly Color DarkTextPrimary = Color.FromArgb(245, 245, 247);
        internal static readonly Color DarkTextSecondary = Color.FromArgb(174, 174, 178);
        internal static readonly Color DarkTextMuted = Color.FromArgb(142, 142, 147);
        internal static readonly Color DarkAccent = Color.FromArgb(10, 132, 255);
        internal static readonly Color DarkAccentHover = Color.FromArgb(64, 156, 255);
        internal static readonly Color DarkAccentPressed = Color.FromArgb(0, 113, 227);
        internal static readonly Color DarkAccentSoft = Color.FromArgb(26, 44, 76);
        internal static readonly Color DarkOnline = Color.FromArgb(48, 209, 88);
        internal static readonly Color DarkWarn = Color.FromArgb(255, 159, 10);
        internal static readonly Color DarkCritical = Color.FromArgb(255, 105, 97);
        internal static readonly Color DarkCriticalInk = Color.FromArgb(28, 28, 30);
        internal static readonly Color DarkMenuBackground = Color.FromArgb(32, 32, 34);
        internal static readonly Color DarkMenuSurface = Color.FromArgb(40, 40, 44);
        internal static readonly Color DarkMenuHover = Color.FromArgb(50, 50, 56);
        internal static readonly Color DarkMenuSelected = Color.FromArgb(26, 44, 76);
        internal static readonly Color DarkMenuBorder = Color.FromArgb(56, 56, 60);
        internal static readonly Color DarkMenuBorderStrong = Color.FromArgb(72, 72, 76);

        // ---- Merek (tidak bertema; hanya untuk logo) ----
        internal static readonly Color NavyBrand = Color.FromArgb(15, 58, 117);
    }
}
```

- [ ] **Step 4: Ganti blok token di `FluentTheme.cs`**

Hapus `FluentTheme.cs:18-36` (blok Slate), `:39-50` (blok Zinc), `:53-75` (blok Glass/Accent/Danger), dan ganti seluruhnya dengan:

```csharp
        // ================= 1. COLOR TOKENS =================
        // Nilai mentah ada di ThemeTokens.cs. Semua akses lewat properti adaptif di bawah.

        /// <summary>Navy merek Santos. Hanya untuk logo — bukan warna antarmuka.</summary>
        public static readonly Color NavyBrand = ThemeTokens.NavyBrand;
```

Lalu ganti blok token adaptif `FluentTheme.cs:136-173` dengan:

```csharp
        // Adaptive Canvas & Card Tokens
        public static Color ThemeCanvasTop => IsDarkTheme ? ThemeTokens.DarkCanvas : ThemeTokens.LightCanvas;
        public static Color ThemeCanvasBottom => IsDarkTheme ? ThemeTokens.DarkCanvasBottom : ThemeTokens.LightCanvasBottom;
        public static Color ThemeSidebar => IsDarkTheme ? ThemeTokens.DarkSidebar : ThemeTokens.LightSidebar;
        public static Color ThemeSurface => IsDarkTheme ? ThemeTokens.DarkSurface : ThemeTokens.LightSurface;
        public static Color ThemeSurfaceSoft => IsDarkTheme ? ThemeTokens.DarkSurfaceSoft : ThemeTokens.LightSurfaceSoft;
        public static Color ThemeCardFill => IsDarkTheme ? ThemeTokens.DarkSurface : ThemeTokens.LightSurface;
        public static Color ThemeCardFillSoft => IsDarkTheme ? ThemeTokens.DarkSurfaceSoft : ThemeTokens.LightSurfaceSoft;
        public static Color ThemeCardHairline => IsDarkTheme ? ThemeTokens.DarkHairline : ThemeTokens.LightHairline;
        public static Color ThemeCardHairlineStrong => IsDarkTheme ? ThemeTokens.DarkHairlineStrong : ThemeTokens.LightHairlineStrong;
        public static Color ThemeCardHighlight => IsDarkTheme ? ThemeTokens.DarkHighlight : ThemeTokens.LightHighlight;
        public static Color ThemeHover => IsDarkTheme ? ThemeTokens.DarkHover : ThemeTokens.LightHover;
        public static Color ThemeInputWell => IsDarkTheme ? ThemeTokens.DarkWell : ThemeTokens.LightWell;
        public static Color ThemeInputBorder => IsDarkTheme ? ThemeTokens.DarkInputBorder : ThemeTokens.LightInputBorder;

        // Adaptive Typography Tokens
        public static Color ThemeTextPrimary => IsDarkTheme ? ThemeTokens.DarkTextPrimary : ThemeTokens.LightTextPrimary;
        public static Color ThemeTextSecondary => IsDarkTheme ? ThemeTokens.DarkTextSecondary : ThemeTokens.LightTextSecondary;
        public static Color ThemeTextMuted => IsDarkTheme ? ThemeTokens.DarkTextMuted : ThemeTokens.LightTextMuted;

        // Adaptive Accent Tokens
        public static Color ThemeAccent => IsDarkTheme ? ThemeTokens.DarkAccent : ThemeTokens.LightAccent;
        public static Color ThemeAccentHover => IsDarkTheme ? ThemeTokens.DarkAccentHover : ThemeTokens.LightAccentHover;
        public static Color ThemeAccentPressed => IsDarkTheme ? ThemeTokens.DarkAccentPressed : ThemeTokens.LightAccentPressed;
        public static Color ThemeAccentSoft => IsDarkTheme ? ThemeTokens.DarkAccentSoft : ThemeTokens.LightAccentSoft;
        public static Color ThemeAccentText => ThemeAccent;

        // Adaptive Menu & Dropdown Tokens
        public static Color ThemeMenuBackground => IsDarkTheme ? ThemeTokens.DarkMenuBackground : ThemeTokens.LightMenuBackground;
        public static Color ThemeMenuSurface => IsDarkTheme ? ThemeTokens.DarkMenuSurface : ThemeTokens.LightMenuSurface;
        public static Color ThemeMenuHover => IsDarkTheme ? ThemeTokens.DarkMenuHover : ThemeTokens.LightMenuHover;
        public static Color ThemeMenuSelected => IsDarkTheme ? ThemeTokens.DarkMenuSelected : ThemeTokens.LightMenuSelected;
        public static Color ThemeMenuBorder => IsDarkTheme ? ThemeTokens.DarkMenuBorder : ThemeTokens.LightMenuBorder;
        public static Color ThemeMenuBorderStrong => IsDarkTheme ? ThemeTokens.DarkMenuBorderStrong : ThemeTokens.LightMenuBorderStrong;
        public static Color ThemeMenuTextPrimary => ThemeTextPrimary;
        public static Color ThemeMenuTextSecondary => ThemeTextSecondary;

        // Status Tokens
        public static Color ThemeStatusOnline => IsDarkTheme ? ThemeTokens.DarkOnline : ThemeTokens.LightOnline;
        public static Color ThemeStatusWarn => IsDarkTheme ? ThemeTokens.DarkWarn : ThemeTokens.LightWarn;
        public static Color ThemeStatusCritical => IsDarkTheme ? ThemeTokens.DarkCritical : ThemeTokens.LightCritical;
        public static Color ThemeStatusCriticalText => IsDarkTheme ? ThemeTokens.DarkCriticalInk : ThemeTokens.LightCriticalInk;
        public static Color ThemeStatusOnlineBg => Color.FromArgb(IsDarkTheme ? 28 : 24, ThemeStatusOnline);
        public static Color ThemeStatusOfflineBg => Color.FromArgb(IsDarkTheme ? 28 : 24, ThemeStatusCritical);

        // Kompatibilitas pemanggil lama — dipetakan ke token status.
        public static Color StatusOnline => ThemeStatusOnline;
        public static Color StatusOffline => ThemeStatusCritical;
        public static Color StatusPending => ThemeStatusWarn;
```

Catatan: `StatusOnline`/`StatusOffline`/`StatusPending` sebelumnya `static readonly Color` (field). Diubah jadi properti agar ikut tema. Pemanggil membacanya sama saja.

- [ ] **Step 5: Ganti token prioritas**

Ganti `FluentTheme.cs:176-226` (empat tuple `Priority*` dan `GetPriorityTheme`) dengan:

```csharp
        public static (Color Bg, Color Text, Color Border) GetPriorityTheme(string? priority)
        {
            string p = priority?.ToLowerInvariant() ?? "";

            Color accent;
            if (p == "critical" || p == "blocker") accent = ThemeStatusCritical;
            else if (p == "high" || p == "urgent") accent = ThemeStatusWarn;
            else if (p == "low") accent = ThemeStatusOnline;
            else accent = ThemeAccent;

            return (
                Color.FromArgb(IsDarkTheme ? 32 : 22, accent),
                accent,
                Color.FromArgb(IsDarkTheme ? 72 : 64, accent)
            );
        }
```

`GetPriorityDisplayLabel` (`:228-236`) tidak diubah.

- [ ] **Step 6: Perbaiki referensi yang putus di `FluentTheme.cs`**

Token yang dihapus masih dipakai di dalam `FluentTheme.cs` sendiri. Ganti:
- `:403-404` `PaintFrostedCanvas` — `GlassCanvasTop`/`GlassCanvasBottom` → `ThemeCanvasTop`/`ThemeCanvasBottom`, dan hapus cabang literal `246,248,250`/`240,243,246` sehingga:
  ```csharp
            Color bgTop = ThemeCanvasTop;
            Color bgBot = ThemeCanvasBottom;
  ```
- `:409-411` tint akrilik:
  ```csharp
                Color tintColor = Color.FromArgb(dark ? 170 : 175, ThemeCanvasBottom);
  ```
- `:469,473,479` bayangan kartu — biarkan (hitam beralfa, bukan warna palet).
- `:501-503` specular — ganti dengan `ThemeCardHighlight`.
- `:604` `GetMenuIcon` default tint — `DarkMenuTextSecondary`/`TextSecondary` → `ThemeTextSecondary`.
- `:725` ikon `exit` merah literal `239,68,68` → `ThemeStatusCritical`.
- `:545` `DrawRoundedImage` — `BorderSubtle` → `ThemeCardHairline`.
- `:799` `CreateMultiFrameIco` — `203,213,225` literal dipertahankan (ikon ICO di luar tema runtime).

Jalankan `grep -n "GlassCanvas\|GlassCard\|DarkMenu\|BorderSubtle\|BorderStrong\|TextPrimary =\|Background =\|SubtleSurface\|HoverSurface\|SelectedSurface\|NavyHover\|NavyPressed\|AccentGlow\|DangerText\|DangerFill\|DangerHairline\|DangerHover\|DarkBadgeBg\|DarkLiveDot\|GlassInset\|GlassHover\|GlassPressed\|GlassHairline" *.cs` untuk menemukan sisa referensi di berkas lain. Berkas lain ditangani di Task 5–11; **untuk task ini, tambahkan properti alias sementara** di `FluentTheme.cs` agar build tetap hijau:

```csharp
        // ---- Alias sementara (dihapus di Task 12 setelah semua pemanggil dimigrasi) ----
        public static Color Background => ThemeCanvasTop;
        public static Color Surface => ThemeSurface;
        public static Color SubtleSurface => ThemeSurfaceSoft;
        public static Color HoverSurface => ThemeMenuHover;
        public static Color SelectedSurface => ThemeMenuSelected;
        public static Color BorderSubtle => ThemeCardHairline;
        public static Color BorderStrong => ThemeCardHairlineStrong;
        public static Color TextPrimary => ThemeTextPrimary;
        public static Color TextSecondary => ThemeTextSecondary;
        public static Color TextMuted => ThemeTextMuted;
        public static Color NavyHover => ThemeAccentHover;
        public static Color NavyPressed => ThemeAccentPressed;
        public static Color DarkMenuBackground => ThemeMenuBackground;
        public static Color DarkMenuSurface => ThemeMenuSurface;
        public static Color DarkMenuHover => ThemeMenuHover;
        public static Color DarkMenuSelected => ThemeMenuSelected;
        public static Color DarkMenuBorder => ThemeMenuBorder;
        public static Color DarkMenuBorderStrong => ThemeMenuBorderStrong;
        public static Color DarkMenuTextPrimary => ThemeTextPrimary;
        public static Color DarkMenuTextSecondary => ThemeTextSecondary;
        public static Color DarkMenuTextMuted => ThemeTextMuted;
        public static Color DarkLiveDot => ThemeStatusOnline;
        public static Color DarkLiveDotHalo => ThemeStatusOnlineBg;
        public static Color DarkBadgeBg => ThemeSurfaceSoft;
        public static Color GlassCanvasTop => ThemeCanvasTop;
        public static Color GlassCanvasBottom => ThemeCanvasBottom;
        public static Color GlassCardFill => ThemeCardFill;
        public static Color GlassCardFillSoft => ThemeCardFillSoft;
        public static Color GlassHairline => ThemeCardHairline;
        public static Color GlassHairlineStrong => ThemeCardHairlineStrong;
        public static Color GlassHover => ThemeMenuHover;
        public static Color GlassPressed => ThemeMenuSelected;
        public static Color GlassInset => ThemeInputWell;
        public static Color Accent => ThemeAccent;
        public static Color AccentHover => ThemeAccentHover;
        public static Color AccentPressed => ThemeAccentPressed;
        public static Color AccentSoft => ThemeAccentSoft;
        public static Color AccentGlow => Color.FromArgb(20, ThemeAccent);
        public static Color AccentText => ThemeAccentText;
        public static Color DangerText => ThemeStatusCritical;
        public static Color DangerFill => Color.FromArgb(32, ThemeStatusCritical);
        public static Color DangerHairline => Color.FromArgb(64, ThemeStatusCritical);
        public static Color DangerHover => Color.FromArgb(48, ThemeStatusCritical);
```

- [ ] **Step 7: Build dan jalankan test**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
```

Expected: build sukses, 31 test lama + 12 test baru lulus (total 43).

- [ ] **Step 8: Commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/sja-notification-app/ThemeTokens.cs apps/sja-notification-app/FluentTheme.cs apps/sja-notification-app-tests/ThemeTokenTests.cs
git commit -m "$(cat <<'EOF'
refactor(sja-notifier): satukan tiga palet warisan jadi satu set token adaptif

Blok Slate, Zinc, dan Glass di FluentTheme diganti nilai palet tunggal yang
dipisah ke ThemeTokens.cs. Token prioritas berhenti memakai nilai Tailwind dan
diturunkan dari token status. Nama properti dipertahankan sehingga pemanggil
tidak berubah; alias sementara ditambahkan dan dihapus di task terakhir.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Harness render diperluas

Dikerjakan lebih dulu agar setiap task berikutnya bisa diverifikasi secara visual, dan agar penghapusan form di Task 12 tidak merusak harness.

**Files:**
- Modify: `apps/sja-notification-app/Program.cs:180-207` (settings), `:209-247` (history), tambah blok baru setelah `:277`
- Create: `scripts/render-previews.ps1`

**Interfaces:**
- Consumes: `FluentTheme.SetThemeOverride(bool?)`, `MainWindowForm.PreviewState(string)` (sudah ada, `MainWindowForm.cs:1805`).
- Produces:
  - Flag CLI: `--test-render-main <dashboard|history|settings|login|empty|disconnected> <light|dark>`, `--test-render-tray`, `--test-render-popup`, `--test-render-remote`, `--test-render-remote-viewer`, `--test-render-remote-privacy`.
  - `MainWindowForm.PreviewState(string mode)` menerima dua mode tambahan: `"empty"` (masuk, riwayat kosong) dan `"disconnected"` (masuk, gateway terputus).
  - `scripts/render-previews.ps1` — merender seluruh permukaan dalam dua tema.
  - Flag dialog konfirmasi ditambahkan di Task 9, bersamaan dengan kode dialognya.

- [ ] **Step 1: Alihkan `--test-render-settings` dan `--test-render-history` ke jendela utama**

`PreviewState` sudah mendukung mode `history` dan `settings` lewat `SwitchNavTab` (`MainWindowForm.cs:1837-1844`), jadi kedua flag ini tidak perlu form terpisah.

Hapus seluruh blok `Program.cs:180-247` (dua blok `if`) dan ganti dengan:

```csharp
            // --test-render-settings dan --test-render-history dialihkan ke jendela utama
            // (SettingsForm/HistoryForm dihapus; satu jendela, tiga halaman).
            if (args != null && args.Length > 0 &&
                (args[0] == "--test-render-settings" || args[0] == "--test-render-history"))
            {
                string page = args[0] == "--test-render-settings" ? "settings" : "history";
                string theme = args.Length > 1 ? args[1] : "dark";
                args = new[] { "--test-render-main", page, theme };
            }
```

Letakkan blok ini **sebelum** blok `--test-render-main` di `:60`, sehingga argumen yang sudah ditulis ulang jatuh ke handler jendela utama.

- [ ] **Step 2: Seed riwayat untuk mode history**

Blok `--test-render-history` yang lama menyuntikkan satu item riwayat (`Program.cs:219-227`). Pindahkan ke dalam handler `--test-render-main`, tepat setelah `FluentTheme.SetThemeOverride(!isLight);` di `:68`:

```csharp
                if (string.Equals(mode, "history", StringComparison.OrdinalIgnoreCase) &&
                    LocalNotificationHistory.LoadAll().Count == 0)
                {
                    LocalNotificationHistory.Add(new NotificationData
                    {
                        App = "iDesk Support",
                        TicketNumber = "TKT-2026-1042",
                        Title = "Tiket Baru #TKT-2026-1042: Kendala Printer Lantai 2",
                        Message = "Dear Tim IT, printer jaringan di lantai 2 SPJ mendadak offline dan antrean cetak macet.",
                        Priority = "high",
                        Timestamp = DateTime.Now.AddMinutes(-12)
                    });
                }
```

Isi notifikasi sengaja tetap Indonesia — ini mensimulasikan data server, yang menurut Global Constraints tidak diterjemahkan.

- [ ] **Step 3: Tambah flag untuk permukaan Remote yang belum tercakup**

Tambahkan setelah blok `--test-render-remote` (`Program.cs:277`):

```csharp
            if (args != null && args.Length > 0 && args[0] == "--test-render-remote-viewer")
            {
                Application.SetHighDpiMode(HighDpiMode.SystemAware);
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                bool isLight = args.Length > 1 && args[1].Equals("light", StringComparison.OrdinalIgnoreCase);
                FluentTheme.SetThemeOverride(!isLight);

                var config = new AppConfig();
                using var form = new RemoteViewerForm(config, "SPJ-IT-014", "Bagas IT Infrastructure", "10.10.4.21");
                form.StartPosition = FormStartPosition.Manual;
                form.Location = new System.Drawing.Point(-2000, -2000);
                form.Show();
                Application.DoEvents();

                using var bmp = new System.Drawing.Bitmap(form.Width, form.Height);
                form.DrawToBitmap(bmp, new System.Drawing.Rectangle(0, 0, form.Width, form.Height));

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string outPath = Path.Combine(baseDir, $"remote-viewer-{(isLight ? "light" : "dark")}-preview.png");
                bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
                Console.WriteLine($"PREVIEW_SAVED:{outPath}");
                Process.GetCurrentProcess().Kill();
                return;
            }

            if (args != null && args.Length > 0 && args[0] == "--test-render-remote-privacy")
            {
                Application.SetHighDpiMode(HighDpiMode.SystemAware);
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                bool isLight = args.Length > 1 && args[1].Equals("light", StringComparison.OrdinalIgnoreCase);
                FluentTheme.SetThemeOverride(!isLight);

                using var form = new RemotePrivacyOverlayForm("Santos ICT Support", "10.10.4.21");
                form.StartPosition = FormStartPosition.Manual;
                form.Location = new System.Drawing.Point(-2000, -2000);
                form.TopMost = false;
                form.Show();
                Application.DoEvents();

                using var bmp = new System.Drawing.Bitmap(form.Width, form.Height);
                form.DrawToBitmap(bmp, new System.Drawing.Rectangle(0, 0, form.Width, form.Height));

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string outPath = Path.Combine(baseDir, $"remote-privacy-{(isLight ? "light" : "dark")}-preview.png");
                bmp.Save(outPath, System.Drawing.Imaging.ImageFormat.Png);
                Console.WriteLine($"PREVIEW_SAVED:{outPath}");
                Process.GetCurrentProcess().Kill();
                return;
            }
```

**Sebelum menulis blok ini, baca tanda tangan konstruktor sebenarnya:**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app"
grep -n "public RemoteViewerForm\|public RemotePrivacyOverlayForm" RemoteViewerForm.cs RemotePrivacyOverlayForm.cs
```

Sesuaikan argumen konstruktor dengan yang terbaca. Jangan menebak.

- [ ] **Step 4: Tambah mode login, empty, dan disconnected ke `PreviewState`**

`PreviewState` sudah menangani mode selain dashboard/history/settings dengan `_session = null` (`MainWindowForm.cs:1829-1833`), yang menghasilkan tampilan sign-in — jadi `--test-render-main login light` sudah bekerja tanpa kode baru.

Dua kondisi yang diminta spec §7 belum ada: riwayat kosong dan gateway terputus. Ubah `PreviewState` (`MainWindowForm.cs:1805-1845`) agar mengenali keduanya:

```csharp
        public void PreviewState(string mode)
        {
            _isPreviewMode = true;

            bool signedIn = mode is "dashboard" or "history" or "settings" or "empty" or "disconnected";

            if (signedIn)
            {
                _session = new UserProfileSession
                {
                    EmployeeId = "00061058",
                    FullName = "RM BAGASTYO ANGGORO INDRASTOTO",
                    Email = "bagastyo.indrastoto@kapalapi.co.id",
                    Role = "ADMIN",
                    SiteCode = "SPJ",
                    Token = "preview_valid_session_token_2026"
                };
                _isConnected = mode != "disconnected";
            }
            else
            {
                _session = null;
                _isConnected = false;
            }

            RefreshDataState();

            if (mode == "history" || mode == "empty") SwitchNavTab("history");
            else if (mode == "settings") SwitchNavTab("settings");
        }
```

Mode `empty` membuka halaman History; karena Step 2 hanya menyuntikkan data contoh saat `mode == "history"`, mode `empty` menghasilkan riwayat kosong tanpa kerja tambahan. Sebelum mengubah, baca `MainWindowForm.cs:1805-1845` untuk memastikan nama field (`_isPreviewMode`, `_session`, `_isConnected`, `RefreshDataState`) sesuai yang ada.

- [ ] **Step 5: Buat skrip render**

Buat `scripts/render-previews.ps1`:

```powershell
# Merender seluruh permukaan aplikasi dalam tema terang dan gelap.
# Jalankan dari root repo: .\scripts\render-previews.ps1

$ErrorActionPreference = "Stop"
$outDir = "apps/sja-notification-app/bin/Debug/net10.0-windows10.0.19041.0"
$exe = Join-Path $outDir "SJANotifier.exe"

if (-not (Test-Path $exe)) {
    Write-Error "Build dulu: dotnet build apps/sja-notification-app/SJANotificationApp.csproj"
}

$surfaces = @(
    @("--test-render-main", "dashboard"),
    @("--test-render-main", "history"),
    @("--test-render-main", "settings"),
    @("--test-render-main", "login"),
    @("--test-render-tray"),
    @("--test-render-popup", "ticket"),
    @("--test-render-popup", "broadcast"),
    @("--test-render-remote"),
    @("--test-render-remote-viewer"),
    @("--test-render-remote-privacy")
)

foreach ($theme in @("light", "dark")) {
    foreach ($s in $surfaces) {
        $argList = $s + @($theme)
        Write-Host "Render: $($argList -join ' ')"
        & $exe @argList | Where-Object { $_ -like "PREVIEW_SAVED:*" }
    }
}

Write-Host "`nSelesai. PNG ada di: $outDir"
```

- [ ] **Step 6: Build dan verifikasi seluruh flag**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
pwsh -File scripts/render-previews.ps1
```

Expected: 20 baris `PREVIEW_SAVED:` (10 permukaan × 2 tema), tanpa exception.

Buka beberapa PNG dan pastikan bukan gambar kosong. Bila satu permukaan gagal dirender, perbaiki flag-nya sekarang — task berikutnya bergantung padanya.

- [ ] **Step 7: Jalankan test**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
```

Expected: 43 test lulus.

- [ ] **Step 8: Commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/sja-notification-app/Program.cs scripts/render-previews.ps1
git commit -m "$(cat <<'EOF'
test(sja-notifier): perluas harness render ke seluruh permukaan

Flag settings dan history dialihkan ke jendela utama karena PreviewState sudah
mendukung keduanya lewat SwitchNavTab, sehingga SettingsForm dan HistoryForm
bisa dihapus tanpa merusak harness. Ditambahkan flag untuk viewer remote dan
privacy overlay, plus skrip yang merender semuanya dalam dua tema.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Font deterministik

**Files:**
- Modify: `apps/sja-notification-app/FluentTheme.cs:241-257`
- Test: `apps/sja-notification-app-tests/ThemeTokenTests.cs` (tambah)

**Interfaces:**
- Consumes: —
- Produces: `FluentTheme.GetFont(float, FontStyle)` — tanda tangan tidak berubah; family yang dipilih kini deterministik di seluruh komputer.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `ThemeTokenTests.cs`:

```csharp
        [Fact]
        public void FontFamily_NeverResolvesToApplePlatformFonts()
        {
            using var font = FluentTheme.GetFont(9F);
            Assert.DoesNotContain("SF Pro", font.Name);
        }

        [Fact]
        public void FontFamily_IsAWindowsSystemFace()
        {
            using var font = FluentTheme.GetFont(9F);
            Assert.True(
                font.Name.StartsWith("Segoe UI") || font.Name == "Arial",
                $"Font tak terduga: {font.Name}");
        }
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj --filter "FullyQualifiedName~FontFamily" -v q --nologo
```

Expected: di komputer tanpa SF Pro, test ini **lulus** meski kodenya belum diubah — itu justru bukti masalahnya (hasil bergantung komputer). Catat hasilnya, lalu tetap lanjut ke Step 3; testnya berfungsi sebagai pagar regresi.

- [ ] **Step 3: Buang kandidat SF Pro**

Ganti `FluentTheme.cs:243`:

```csharp
            string[] candidates = { "Segoe UI Variable Text", "Segoe UI", "Arial" };
```

- [ ] **Step 4: Jalankan test**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
```

Expected: 45 test lulus.

- [ ] **Step 5: Commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/sja-notification-app/FluentTheme.cs apps/sja-notification-app-tests/ThemeTokenTests.cs
git commit -m "$(cat <<'EOF'
fix(sja-notifier): buat pilihan font deterministik di semua komputer

GetBestFontFamily mencoba SF Pro Display dan SF Pro Text lebih dulu, sehingga
komputer yang punya font Apple terpasang menampilkan tipografi berbeda dari
komputer lain. Kandidat dimulai dari Segoe UI Variable Text.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Ikon diseragamkan

**Files:**
- Modify: `apps/sja-notification-app/FluentTheme.cs:589-777` (`GetMenuIcon`)

**Interfaces:**
- Consumes: `FluentTheme.ThemeTextSecondary`, `ThemeStatusCritical` (Task 1).
- Produces: `FluentTheme.GetMenuIcon(string iconName, Color? tintColor = null, int size = 16)` — tanda tangan tidak berubah. Kunci ikon bertambah: `"chevron-right"`, `"external"`, `"search"`, `"refresh"`, `"warning"`, `"maximize"`, `"restore"`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/sja-notification-app-tests/IconTests.cs`:

```csharp
using System.Drawing;
using SJANotificationApp;
using Xunit;

namespace SJANotificationApp.Tests
{
    public class IconTests
    {
        [Theory]
        [InlineData("home")]
        [InlineData("history")]
        [InlineData("settings")]
        [InlineData("remote")]
        [InlineData("idesk")]
        [InlineData("close")]
        [InlineData("minimize")]
        [InlineData("maximize")]
        [InlineData("restore")]
        [InlineData("chevron-down")]
        [InlineData("chevron-right")]
        [InlineData("external")]
        [InlineData("search")]
        [InlineData("refresh")]
        [InlineData("warning")]
        [InlineData("check")]
        [InlineData("trash")]
        [InlineData("exit")]
        public void GetMenuIcon_DrawsSomething(string key)
        {
            using var bmp = FluentTheme.GetMenuIcon(key, Color.Black, 16);

            Assert.Equal(16, bmp.Width);
            Assert.Equal(16, bmp.Height);

            bool anyPixelDrawn = false;
            for (int x = 0; x < bmp.Width && !anyPixelDrawn; x++)
                for (int y = 0; y < bmp.Height && !anyPixelDrawn; y++)
                    if (bmp.GetPixel(x, y).A > 0) anyPixelDrawn = true;

            Assert.True(anyPixelDrawn, $"Ikon '{key}' tidak menggambar apa pun");
        }

        [Fact]
        public void GetMenuIcon_RespectsRequestedSize()
        {
            using var bmp = FluentTheme.GetMenuIcon("home", Color.Black, 24);
            Assert.Equal(24, bmp.Width);
            Assert.Equal(24, bmp.Height);
        }

        [Fact]
        public void ExitIcon_UsesTintNotHardcodedRed()
        {
            using var bmp = FluentTheme.GetMenuIcon("exit", Color.Blue, 16);

            bool foundTailwindRed = false;
            for (int x = 0; x < bmp.Width; x++)
                for (int y = 0; y < bmp.Height; y++)
                {
                    var p = bmp.GetPixel(x, y);
                    if (p.A > 200 && p.R > 220 && p.G < 90 && p.B < 90) foundTailwindRed = true;
                }

            Assert.False(foundTailwindRed, "Ikon exit masih mengunci merah literal");
        }
    }
}
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj --filter "FullyQualifiedName~IconTests" -v q --nologo
```

Expected: FAIL — `maximize`, `restore`, `chevron-right`, `external`, `search`, `refresh`, `warning` belum ada (bitmap kosong), dan `ExitIcon_UsesTintNotHardcodedRed` gagal karena `:725`.

- [ ] **Step 3: Tambah ikon baru dan seragamkan stroke**

Di `FluentTheme.cs`, ganti `case "exit":` (`:724-734`) sehingga memakai `pen` biasa, bukan `redPen`:

```csharp
                case "exit":
                    g.DrawLine(pen, 7f, 2.5f, 3f, 2.5f);
                    g.DrawLine(pen, 3f, 2.5f, 3f, 12.5f);
                    g.DrawLine(pen, 3f, 12.5f, 7f, 12.5f);
                    g.DrawLine(pen, 6f, 7.5f, 13f, 7.5f);
                    g.DrawLine(pen, 10.5f, 5f, 13f, 7.5f);
                    g.DrawLine(pen, 10.5f, 10f, 13f, 7.5f);
                    break;
```

Pemanggil yang ingin ikon exit merah meneruskan `FluentTheme.ThemeStatusCritical` sebagai `tintColor`.

Tambahkan case baru sebelum penutup `switch` (`:774`):

```csharp
                case "chevron-right":
                    g.DrawLines(pen, new[]
                    {
                        new PointF(6.5f, 4.5f),
                        new PointF(10f, 8f),
                        new PointF(6.5f, 11.5f)
                    });
                    break;

                case "maximize":
                    g.DrawRectangle(pen, 4f, 4f, 8f, 8f);
                    break;

                case "restore":
                    g.DrawRectangle(pen, 3f, 6f, 7f, 7f);
                    g.DrawLine(pen, 6f, 3.5f, 12.5f, 3.5f);
                    g.DrawLine(pen, 12.5f, 3.5f, 12.5f, 10f);
                    break;

                case "external":
                    g.DrawLine(pen, 7f, 3f, 3.5f, 3f);
                    g.DrawLine(pen, 3.5f, 3f, 3.5f, 12.5f);
                    g.DrawLine(pen, 3.5f, 12.5f, 13f, 12.5f);
                    g.DrawLine(pen, 13f, 12.5f, 13f, 9f);
                    g.DrawLine(pen, 8.5f, 7.5f, 13f, 3f);
                    g.DrawLine(pen, 9.5f, 3f, 13f, 3f);
                    g.DrawLine(pen, 13f, 3f, 13f, 6.5f);
                    break;

                case "search":
                    g.DrawEllipse(pen, 3f, 3f, 8f, 8f);
                    g.DrawLine(pen, 10f, 10f, 13.5f, 13.5f);
                    break;

                case "refresh":
                    g.DrawArc(pen, 3f, 3f, 10f, 10f, 60, 250);
                    g.DrawLines(pen, new[]
                    {
                        new PointF(9.5f, 1.5f),
                        new PointF(12.8f, 4.2f),
                        new PointF(9.3f, 6f)
                    });
                    break;

                case "warning":
                    g.DrawLines(pen, new[]
                    {
                        new PointF(8f, 2.5f),
                        new PointF(14f, 13f),
                        new PointF(2f, 13f),
                        new PointF(8f, 2.5f)
                    });
                    g.DrawLine(pen, 8f, 6f, 8f, 9.5f);
                    g.FillEllipse(brush, 7.2f, 10.8f, 1.6f, 1.6f);
                    break;
```

Seragamkan ikon yang mencampur sudut tajam dengan garis berujung bulat — ganti `DrawRectangle` dengan jalur membulat pada ikon `archive` (`:699`) dan `startup` (`:719`):

```csharp
                case "archive":
                    using (var arcPath = CreateRoundedPath(new Rectangle(2, 3, 11, 9), 2))
                        g.DrawPath(pen, arcPath);
                    g.DrawLine(pen, 2f, 6.5f, 13f, 6.5f);
                    g.DrawLine(pen, 6f, 9f, 9f, 9f);
                    break;

                case "startup":
                    using (var stPath = CreateRoundedPath(new Rectangle(2, 2, 11, 11), 2))
                        g.DrawPath(pen, stPath);
                    g.DrawLine(pen, 4.5f, 7.5f, 6.5f, 9.5f);
                    g.DrawLine(pen, 6.5f, 9.5f, 10.5f, 5.5f);
                    break;
```

- [ ] **Step 4: Jalankan test**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
```

Expected: 65 test lulus (45 + 20 dari `IconTests`).

- [ ] **Step 5: Commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/sja-notification-app/FluentTheme.cs apps/sja-notification-app-tests/IconTests.cs
git commit -m "$(cat <<'EOF'
feat(sja-notifier): seragamkan ikon vektor dan tambah ikon yang kurang

Ikon exit berhenti mengunci merah literal dan mengikuti tint pemanggil. Ikon
archive dan startup memakai sudut membulat agar sejalan dengan ujung garis
membulat di ikon lain. Ditambahkan chevron-right, maximize, restore, external,
search, refresh, dan warning untuk permukaan hasil redesign.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Kontrol kustom — dropdown, toggle, tombol

**Files:**
- Modify: `apps/sja-notification-app/GlassControls.cs` (16 literal warna), `apps/sja-notification-app/FluentMenuRenderer.cs`

**Interfaces:**
- Consumes: token dari Task 1, `GetMenuIcon` dari Task 4.
- Produces: `GlassButton`, `GlassDropdown`, `GlassDropdownList`, `FluentToggleSwitch`, `FluentScrollBar` — nama kelas dan properti publik tidak berubah.

- [ ] **Step 1: Petakan literal warna**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app"
grep -n "Color\.FromArgb" GlassControls.cs FluentMenuRenderer.cs
```

Catat setiap baris dan perannya sebelum mengubah apa pun.

- [ ] **Step 2: Ganti setiap literal dengan token**

Aturan pemetaan:

| Peran literal | Token pengganti |
|---|---|
| latar kontrol | `FluentTheme.ThemeSurface` |
| latar kontrol lembut / isian netral | `FluentTheme.ThemeSurfaceSoft` |
| sumur input | `FluentTheme.ThemeInputWell` |
| garis tepi | `FluentTheme.ThemeCardHairline` |
| garis tepi tegas / border input | `FluentTheme.ThemeInputBorder` |
| teks utama | `FluentTheme.ThemeTextPrimary` |
| teks sekunder | `FluentTheme.ThemeTextSecondary` |
| teks redup | `FluentTheme.ThemeTextMuted` |
| hover | `FluentTheme.ThemeMenuHover` |
| terpilih / aktif | `FluentTheme.ThemeMenuSelected` |
| aksen / tombol utama | `FluentTheme.ThemeAccent` |
| bahaya | `FluentTheme.ThemeStatusCritical` |

Setelah selesai, `grep -c "Color.FromArgb" GlassControls.cs FluentMenuRenderer.cs` harus mengembalikan 0 untuk keduanya, **kecuali** pemakaian `Color.FromArgb(alpha, existingColor)` untuk mengatur transparansi token yang sudah ada — bentuk itu diizinkan.

- [ ] **Step 3: Setel dropdown ke spesifikasi bersama**

Di `GlassDropdownList` (`GlassControls.cs:469` menurut inventaris; verifikasi nomor barisnya dengan `grep -n "class GlassDropdownList" GlassControls.cs`), tetapkan:

```csharp
        private const int RowHeight = 34;
        private const int PanelRadius = 8;
        private const int RowRadius = 6;
        private const int CheckSlotWidth = 17;
        private const int PanelPadding = 6;
```

Setiap baris menggambar slot centang di kiri selebar `CheckSlotWidth`; pilihan aktif memakai `FluentTheme.DrawCheckmark(g, origin, FluentTheme.ThemeAccent)` (helper sudah ada di `FluentTheme.cs:433`).

Terapkan angka yang sama di `FluentMenuRenderer.cs` sehingga submenu tray dan dropdown Settings terlihat identik.

- [ ] **Step 4: Toggle gaya Windows 11**

Di `FluentToggleSwitch`, tetapkan proporsi: lebar 40, tinggi 22, knop 14, jarak tepi 4. Mati → isian `FluentTheme.ThemeSurfaceSoft` dengan tepi `ThemeInputBorder`; menyala → isian `FluentTheme.ThemeAccent` tanpa tepi, knop putih. Bukan hijau macOS.

- [ ] **Step 5: Build dan render**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
pwsh -File scripts/render-previews.ps1
```

Buka `tray-menu-light-preview.png` dan `tray-menu-dark-preview.png`. Periksa: tinggi baris seragam, slot centang sejajar, tidak ada warna di luar palet.

- [ ] **Step 6: Jalankan test**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
```

Expected: 65 test lulus.

- [ ] **Step 7: Commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/sja-notification-app/GlassControls.cs apps/sja-notification-app/FluentMenuRenderer.cs
git commit -m "$(cat <<'EOF'
refactor(sja-notifier): satukan gaya kontrol kustom ke token tema

Enam belas literal warna di GlassControls dan FluentMenuRenderer diganti token.
Dropdown, submenu tray, dan pemilih Settings memakai satu spesifikasi panel
melayang: radius 8, baris 34px, slot centang kiri. Toggle memakai gaya
Windows 11 dengan warna aksen.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Popup notifikasi

**Files:**
- Modify: `apps/sja-notification-app/NotificationPopupForm.cs`

**Interfaces:**
- Consumes: token Task 1, `GetPriorityTheme` Task 1.
- Produces: `NotificationPopupForm(NotificationData)` — tanda tangan tidak berubah.

- [ ] **Step 1: Baca berkas dan petakan elemen**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app"
grep -n "Color\.FromArgb\|_lblTitle\|_lblMessage\|Height =\|DrawString" NotificationPopupForm.cs | head -40
```

- [ ] **Step 2: Ganti satu literal warna dengan token**

Berkas ini hanya punya satu `Color.FromArgb` menurut pemetaan awal. Ganti sesuai perannya menggunakan tabel di Task 5 Step 2.

- [ ] **Step 3: Batasi judul dan cuplikan pesan**

Judul maksimal 2 baris, cuplikan pesan maksimal 3 baris, keduanya dengan elipsis. Gunakan `TextFormatFlags.EndEllipsis | TextFormatFlags.WordBreak` pada `TextRenderer.DrawText`, atau `StringTrimming.EllipsisWord` bila memakai `Graphics.DrawString`.

- [ ] **Step 4: Hapus batang merah selebar popup**

Cari elemen dekoratif severity selebar popup dan hapus. Prioritas tetap ditandai, tetapi lewat chip kecil dari `GetPriorityTheme`, bukan batang penuh.

- [ ] **Step 5: Satu aksi utama**

Pastikan hanya ada satu tombol beraksen; aksi lain jadi tombol netral. Aturan durasi, suara, dan kemunculan **tidak disentuh** — jangan ubah timer, `ShowWithoutActivation`, atau pemanggilan suara apa pun.

- [ ] **Step 6: Build dan render**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app/bin/Debug/net10.0-windows10.0.19041.0"
./SJANotifier.exe --test-render-popup ticket light
./SJANotifier.exe --test-render-popup ticket dark
./SJANotifier.exe --test-render-popup broadcast light
./SJANotifier.exe --test-render-popup broadcast dark
```

Buka keempat PNG. Periksa: judul tidak terpotong di tengah kata, lampiran terbaca, satu tombol beraksen, tidak ada batang merah.

- [ ] **Step 7: Jalankan test dan commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/sja-notification-app/NotificationPopupForm.cs
git commit -m "$(cat <<'EOF'
refactor(sja-notifier): rapikan hierarki popup notifikasi

Judul dibatasi dua baris dan cuplikan pesan tiga baris dengan elipsis, batang
severity selebar popup dihapus, dan hanya satu aksi yang beraksen. Aturan
durasi, suara, dan kemunculan tidak diubah.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Menu tray

**Files:**
- Modify: `apps/sja-notification-app/TrayApplicationContext.cs` (8 literal warna, label Indonesia, dua `MessageBox` konfirmasi)

**Interfaces:**
- Consumes: token Task 1, ikon Task 4, gaya menu Task 5.
- Produces: `BuildContextMenu()` (privat, dipanggil lewat refleksi oleh harness `Program.cs:101`) — **nama metode ini tidak boleh berubah**, harness bergantung padanya.

- [ ] **Step 1: Ganti 8 literal warna dengan token**

Pakai tabel pemetaan Task 5 Step 2.

- [ ] **Step 2: Terjemahkan label menu**

| Sekarang (Indonesia) | Menjadi (Inggris) |
|---|---|
| `Buka Dashboard` | `Open dashboard` |
| `Buka Portal` | `Open iDesk portal` |
| `Riwayat Notifikasi Desktop...` | `Notification history` |
| `Pengaturan` | `Settings` |
| `Uji Notifikasi` | `Test notification` |
| `Tes Toast Windows` | `Windows toast` |
| `Tes Popup Window` | `Popup window` |
| `Tes Keduanya` | `Both` |
| `Jalankan Saat Windows Start` | `Start with Windows` |
| `Keluar Akun` | `Sign out` |
| `Tutup Notifier` | `Quit notifier` |

Verifikasi teks persisnya lebih dulu — jangan andalkan tabel ini bila kode berbeda:

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app"
grep -n 'ToolStripMenuItem\|Text = "' TrayApplicationContext.cs | sed -n '1,60p'
```

- [ ] **Step 3: Arahkan Riwayat dan Pengaturan ke jendela utama**

Item `Notification history` dan `Settings` harus membuka `MainWindowForm` pada halaman yang sesuai lewat `SwitchNavTab("history")` / `SwitchNavTab("settings")` — bukan `HistoryForm`/`SettingsForm`. Cari pemanggilan `new HistoryForm(` dan `new SettingsForm(` di berkas ini dan ganti.

Pola yang dipakai: dapatkan instance `MainWindowForm` yang sudah ada bila terbuka, kalau belum buat baru, lalu panggil `SwitchNavTab`. Baca bagaimana item `Buka Dashboard` (`:498`) melakukannya dan ikuti pola yang sama.

- [ ] **Step 4: Ganti dua `MessageBox` konfirmasi**

`TrayApplicationContext.cs:606` (keluar akun) dan `:625` (tutup notifier) memakai `MessageBox`. Keduanya menunggu `AppDialogs` dari Task 9 — **untuk task ini, hanya terjemahkan teksnya**, biarkan `MessageBox`. Penggantian dilakukan di Task 9 Step 5.

`MessageBox` transfer file di `:85-90` **tidak diubah** (galat/persetujuan sistem, sesuai Global Constraints) selain terjemahan teksnya.

- [ ] **Step 5: Build, render, uji**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app/bin/Debug/net10.0-windows10.0.19041.0"
./SJANotifier.exe --test-render-tray light
./SJANotifier.exe --test-render-tray dark
```

Periksa PNG: seluruh label Inggris, tinggi baris seragam, kartu header terbaca.

- [ ] **Step 6: Uji manual**

Jalankan aplikasi, klik kanan ikon tray. Pastikan: menu tidak menutup sendiri saat submenu dibuka (mekanisme `_keepMenuOpenRequested` masih bekerja), toggle startup masih menulis kunci Run, dan setiap item membuka yang benar.

- [ ] **Step 7: Commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/sja-notification-app/TrayApplicationContext.cs
git commit -m "$(cat <<'EOF'
refactor(sja-notifier): menu tray memakai token, label Inggris, dan jendela utama

Delapan literal warna diganti token. Item Notification history dan Settings
membuka halaman di jendela utama, bukan jendela terpisah, sehingga hanya ada
satu tampilan per fungsi.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Jendela utama — titlebar, sidebar, Home

Task terbesar. `MainWindowForm.cs` sudah 2189 baris; halaman Home dipindahkan keluar agar tidak bertambah.

**Files:**
- Create: `apps/sja-notification-app/HomeControlPanel.cs`
- Modify: `apps/sja-notification-app/MainWindowForm.cs:308-402` (titlebar), `:791-889` (rail), `:961-1309` (home tab), `:1929-2012` (profile flyout), 28 literal warna

**Interfaces:**
- Consumes: token Task 1, ikon Task 4, kontrol Task 5, `LocalNotificationHistory.LoadAll()` (sudah ada, `LocalNotificationHistory.cs:40`).
- Produces:
  - `class HomeControlPanel : UserControl` dengan konstruktor `public HomeControlPanel(AppConfig config, Action onViewAllRequested)` — mengikuti pola `HistoryControlPanel(AppConfig)` (`HistoryControlPanel.cs:25`).
  - `HomeControlPanel.RefreshData()` — memuat ulang tiga notifikasi terbaru.
  - `MainWindowForm.SwitchNavTab(string tabKey)` (`:1887`) dan `PreviewState(string mode)` (`:1805`) — tanda tangan tidak berubah.

- [ ] **Step 1: Buat `HomeControlPanel.cs`**

Buat `apps/sja-notification-app/HomeControlPanel.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Linq;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Halaman Home: tiga notifikasi terbaru dari riwayat lokal,
    /// diikuti tombol menuju halaman History.
    /// </summary>
    public class HomeControlPanel : Panel
    {
        private const int LatestCount = 3;
        private const int RowHeight = 72;
        private const int RowGap = 8;

        private readonly AppConfig _config;
        private readonly Action _onViewAllRequested;
        private readonly List<NotificationData> _items = new();

        private Label _lblTitle = null!;
        private Label _lblSubtitle = null!;
        private GlassButton _btnViewAll = null!;
        private Panel _pnlHeader = null!;
        private HomeStreamCanvas _canvas = null!;

        public HomeControlPanel(AppConfig config, Action onViewAllRequested)
        {
            _config = config;
            _onViewAllRequested = onViewAllRequested;

            Dock = DockStyle.Fill;
            DoubleBuffered = true;
            BackColor = FluentTheme.ThemeCanvasTop;

            InitializeComponent();
            FluentTheme.ThemeChanged += OnThemeChanged;
            RefreshData();
        }

        private void InitializeComponent()
        {
            _pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 56,
                BackColor = Color.Transparent,
                Padding = new Padding(16, 8, 16, 4)
            };

            _lblTitle = new Label
            {
                Text = "Home",
                Font = FluentTheme.GetFont(14F, FontStyle.Bold),
                ForeColor = FluentTheme.ThemeTextPrimary,
                Location = new Point(16, 6),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _pnlHeader.Controls.Add(_lblTitle);

            _lblSubtitle = new Label
            {
                Text = "Latest notifications",
                Font = FluentTheme.Caption,
                ForeColor = FluentTheme.ThemeTextSecondary,
                Location = new Point(17, 32),
                AutoSize = true,
                BackColor = Color.Transparent
            };
            _pnlHeader.Controls.Add(_lblSubtitle);

            Controls.Add(_pnlHeader);

            var pnlBottom = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 52,
                BackColor = Color.Transparent,
                Padding = new Padding(16, 6, 16, 10)
            };

            _btnViewAll = new GlassButton
            {
                Text = "View all notifications",
                Variant = GlassButtonVariant.Ghost,
                Font = FluentTheme.CaptionBold,
                Radius = 8,
                Size = new Size(180, 34),
                Location = new Point(16, 8)
            };
            _btnViewAll.Click += (s, e) => _onViewAllRequested?.Invoke();
            pnlBottom.Controls.Add(_btnViewAll);

            Controls.Add(pnlBottom);

            _canvas = new HomeStreamCanvas
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent
            };
            _canvas.NotificationClicked += OnNotificationClicked;
            Controls.Add(_canvas);
            _canvas.BringToFront();
        }

        public void RefreshData()
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke(new Action(RefreshData)); return; }

            _items.Clear();
            _items.AddRange(LocalNotificationHistory.LoadAll()
                .OrderByDescending(n => n.Timestamp)
                .Take(LatestCount));

            _canvas.SetItems(_items);
            _btnViewAll.Visible = _items.Count > 0;
            Invalidate(true);
        }

        private void OnNotificationClicked(NotificationData notif)
        {
            string targetUrl = !string.IsNullOrWhiteSpace(notif.Url)
                ? notif.Url
                : (!string.IsNullOrWhiteSpace(notif.ActionUrl) ? notif.ActionUrl : _config.IdeskServerUrl);

            if (!string.IsNullOrWhiteSpace(targetUrl))
            {
                try
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = targetUrl,
                        UseShellExecute = true
                    });
                }
                catch { }
            }
            else
            {
                TrayApplicationContext.ShowPopupWindow(notif);
            }
        }

        private void OnThemeChanged()
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke(new Action(OnThemeChanged)); return; }
            BackColor = FluentTheme.ThemeCanvasTop;
            _lblTitle.ForeColor = FluentTheme.ThemeTextPrimary;
            _lblSubtitle.ForeColor = FluentTheme.ThemeTextSecondary;
            Invalidate(true);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) FluentTheme.ThemeChanged -= OnThemeChanged;
            base.Dispose(disposing);
        }

        private class HomeStreamCanvas : Control
        {
            private readonly List<NotificationData> _items = new();
            private int _hoveredIndex = -1;

            public event Action<NotificationData>? NotificationClicked;

            public HomeStreamCanvas()
            {
                DoubleBuffered = true;
            }

            public void SetItems(IEnumerable<NotificationData> items)
            {
                _items.Clear();
                _items.AddRange(items);
                _hoveredIndex = -1;
                Invalidate();
            }

            protected override void OnMouseMove(MouseEventArgs e)
            {
                base.OnMouseMove(e);
                int oldHover = _hoveredIndex;
                int rowStep = RowHeight + RowGap;

                if (_items.Count == 0)
                {
                    _hoveredIndex = -1;
                }
                else
                {
                    int adjustedY = e.Y - 6;
                    if (adjustedY >= 0)
                    {
                        int index = adjustedY / rowStep;
                        int rem = adjustedY % rowStep;
                        if (index >= 0 && index < _items.Count && rem <= RowHeight && e.X >= 16 && e.X <= ClientSize.Width - 16)
                            _hoveredIndex = index;
                        else
                            _hoveredIndex = -1;
                    }
                    else
                    {
                        _hoveredIndex = -1;
                    }
                }

                if (_hoveredIndex != oldHover)
                {
                    Cursor = _hoveredIndex >= 0 ? Cursors.Hand : Cursors.Default;
                    Invalidate();
                }
            }

            protected override void OnMouseLeave(EventArgs e)
            {
                base.OnMouseLeave(e);
                if (_hoveredIndex != -1)
                {
                    _hoveredIndex = -1;
                    Cursor = Cursors.Default;
                    Invalidate();
                }
            }

            protected override void OnMouseUp(MouseEventArgs e)
            {
                base.OnMouseUp(e);
                if (e.Button == MouseButtons.Left && _hoveredIndex >= 0 && _hoveredIndex < _items.Count)
                {
                    NotificationClicked?.Invoke(_items[_hoveredIndex]);
                }
            }

            protected override void OnPaint(PaintEventArgs e)
            {
                var g = e.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

                int w = ClientSize.Width;
                int h = ClientSize.Height;
                if (w <= 0 || h <= 0) return;

                if (_items.Count == 0)
                {
                    using var fTitle = FluentTheme.GetFont(11F, FontStyle.Bold);
                    using var fSub = FluentTheme.Caption;
                    using var bTitle = new SolidBrush(FluentTheme.ThemeTextPrimary);
                    using var bSub = new SolidBrush(FluentTheme.ThemeTextMuted);
                    using var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };

                    var emptyRect = new Rectangle(16, 20, w - 32, 100);
                    FluentTheme.PaintGlassCard(g, emptyRect, 12, FluentTheme.ThemeCardFillSoft, FluentTheme.ThemeCardHairline, false);
                    g.DrawString("No notifications yet", fTitle, bTitle, new RectangleF(16, 42, w - 32, 22), sf);
                    g.DrawString("Incoming tickets and announcements will appear here.", fSub, bSub, new RectangleF(16, 68, w - 32, 20), sf);
                    return;
                }

                int cardW = Math.Max(200, w - 32);
                int rowStep = RowHeight + RowGap;

                for (int i = 0; i < _items.Count; i++)
                {
                    var notif = _items[i];
                    int cardY = 6 + i * rowStep;
                    var cardRect = new Rectangle(16, cardY, cardW, RowHeight);

                    bool isHover = i == _hoveredIndex;
                    Color fill = isHover ? FluentTheme.ThemeMenuHover : FluentTheme.ThemeCardFill;
                    Color border = isHover ? FluentTheme.ThemeAccent : FluentTheme.ThemeCardHairline;

                    FluentTheme.PaintGlassCard(g, cardRect, 10, fill, border, drawShadow: false);

                    var (priBg, priText, priBorder) = FluentTheme.GetPriorityTheme(notif.Priority);
                    var iconRect = new Rectangle(cardRect.X + 12, cardRect.Y + 12, 34, 34);

                    using (var b = new SolidBrush(priBg)) FluentTheme.FillRoundedRectangle(g, b, iconRect, 8);
                    using (var p = new Pen(priBorder, 1f)) FluentTheme.DrawRoundedRectangle(g, p, iconRect, 8);
                    using (var ico = FluentTheme.GetMenuIcon("bell", priText, 16))
                    {
                        g.DrawImage(ico, iconRect.X + (34 - 16) / 2, iconRect.Y + (34 - 16) / 2);
                    }

                    string ticketNum = notif.TicketNumber ?? notif.TicketId ?? notif.App ?? "Notification";
                    using (var fontTicket = FluentTheme.GetFont(8F, FontStyle.Bold))
                    using (var brushTicket = new SolidBrush(FluentTheme.ThemeAccentText))
                    {
                        g.DrawString(ticketNum, fontTicket, brushTicket, cardRect.X + 54, cardRect.Y + 12);
                    }

                    string timeStr = notif.Timestamp.ToString("HH:mm");
                    using (var fontTime = FluentTheme.Caption)
                    using (var brushTime = new SolidBrush(FluentTheme.ThemeTextMuted))
                    using (var sfTime = new StringFormat { Alignment = StringAlignment.Far })
                    {
                        g.DrawString(timeStr, fontTime, brushTime, new RectangleF(cardRect.Right - 80, cardRect.Y + 12, 70, 18), sfTime);
                    }

                    string titleText = notif.Title ?? notif.Message ?? "";
                    using (var fontTitle = FluentTheme.GetFont(9F, FontStyle.Bold))
                    using (var brushTitle = new SolidBrush(FluentTheme.ThemeTextPrimary))
                    using (var sfTitle = new StringFormat { Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap })
                    {
                        g.DrawString(titleText, fontTitle, brushTitle, new RectangleF(cardRect.X + 54, cardRect.Y + 30, cardW - 70, 18), sfTitle);
                    }

                    string msgText = notif.Message ?? "";
                    using (var fontMsg = FluentTheme.Caption)
                    using (var brushMsg = new SolidBrush(FluentTheme.ThemeTextSecondary))
                    using (var sfMsg = new StringFormat { Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap })
                    {
                        g.DrawString(msgText, fontMsg, brushMsg, new RectangleF(cardRect.X + 54, cardRect.Y + 48, cardW - 70, 18), sfMsg);
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 2: Sederhanakan titlebar**

Di `MainWindowForm.cs:308-402`, hapus dari titlebar: pil status gateway, tombol gerigi ke Settings, tombol matahari/bulan tema. Sisakan nama aplikasi + minimize + close.

Pemindahan fungsinya:
- Status gateway → kaki sidebar (Step 3).
- Tombol gerigi → item `Settings` di sidebar sudah ada (`:888`).
- Tombol tema → sudah ada segmented control di `SettingsControlPanel.cs:145-147`.

Pastikan `SwitchNavTab("settings")` yang dipanggil dari `:344` tidak putus — bila pemanggilnya dihapus, cek tidak ada referensi yatim.

- [ ] **Step 3: Sidebar dua kelompok**

Di `:876-889`, susun ulang `AddRailNavButton` menjadi dua kelompok dengan label kelompok di antaranya:

```csharp
            AddRailNavButton("home", "Home", "home", ref railY, () => SwitchNavTab("home"));
            AddRailNavButton("history", "History", "history", ref railY, () => SwitchNavTab("history"));
            AddRailNavButton("settings", "Settings", "settings", ref railY, () => SwitchNavTab("settings"));

            AddRailGroupLabel("Opens in another window", ref railY);

            AddRailNavButton("remote", "Remote Desktop", "remote", ref railY, () =>
            {
                if (!RemoteAccessPolicy.IsRemoteOperator(_session?.Role, _session?.EmployeeId, _session?.FullName))
                {
                    ShowAlert(RemoteAccessDeniedMessage, isError: true);
                    return;
                }
                OpenRemoteDeviceBrowser();
            });
            AddRailNavButton("portal", "iDesk Portal", "idesk", ref railY, async () => await HandleOpenWebWithSsoAsync());
```

Tambahkan helper `AddRailGroupLabel(string text, ref int y)` yang menggambar label kecil `ThemeTextMuted` huruf 12px dengan jarak 12px di atasnya.

Dua item kelompok kedua memperoleh ikon `external` (Task 4) di sisi kanan.

Tambahkan konstanta pesan gerbang tunggal di kelas ini (menyelesaikan dua redaksi berbeda di `:883` dan `:1558`):

```csharp
        private const string RemoteAccessDeniedMessage =
            "Remote Desktop is available to Admin and Agent accounts only.";
```

Ganti kedua pemakaian lama dengan konstanta ini. `RemoteDeviceBrowserForm` ditangani di Task 10.

- [ ] **Step 4: Kaki sidebar — identitas dan status**

Pindahkan kartu identitas pengguna (`:821-823`) ke kaki sidebar, ditambah satu indikator status gateway (titik + teks `Connected` / `Disconnected`) memakai `FluentTheme.ThemeStatusOnline` / `ThemeStatusCritical`. Ini satu-satunya tempat status ditampilkan.

Tombol `"Ganti Profil ▾"` (`:869`) menjadi `"Switch profile"` **tanpa glyph** — chevron digambar terpisah lewat `GetMenuIcon("chevron-down", ...)`.

- [ ] **Step 5: Ganti home tab dengan `HomeControlPanel`**

Hapus `:961-1309` (kartu identitas, kartu besar portal, dua kotak bento) dan ganti dengan pemasangan `HomeControlPanel`:

```csharp
            _homePanel = new HomeControlPanel(_config, () => SwitchNavTab("history"));
```

Di `SwitchNavTab` (`:1887-1927`), panggil `_homePanel.RefreshData()` saat berpindah ke tab home.

Hapus juga `_pnlRemoteBentoCard` dan penanganan kliknya (`:1276-1285`), serta `_btnRemote` tersembunyi yang masih dialokasikan (`:1289-1290`).

- [ ] **Step 6: Terjemahkan label yang tersisa dan ganti 28 literal warna**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app"
grep -n "Color\.FromArgb" MainWindowForm.cs
grep -nE '"[A-Z][a-z]+ [a-z]+|Masuk|Keluar|Segarkan|Bersihkan|Setelan|Riwayat|Beranda|Ganti|Perangkat|Gagal|Berhasil' MainWindowForm.cs
```

Terjemahkan setiap label antarmuka. **Jangan terjemahkan** nilai yang berasal dari `NotificationData` atau `UserProfileSession`.

Buang glyph dalam teks: `"Masuk & Hubungkan Perangkat ➔"` → `"Sign in and pair device"`.

- [ ] **Step 7: Build, render, uji**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
pwsh -File scripts/render-previews.ps1
```

Periksa `main-window-dashboard-*`, `main-window-history-*`, `main-window-settings-*`, `main-window-login-*` dalam dua tema. Yang harus terlihat: titlebar hanya nama + dua tombol, sidebar dua kelompok, Home berisi tiga notifikasi + satu tombol, status hanya muncul sekali.

- [ ] **Step 8: Commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/sja-notification-app/HomeControlPanel.cs apps/sja-notification-app/MainWindowForm.cs
git commit -m "$(cat <<'EOF'
refactor(sja-notifier): rapikan titlebar, sidebar, dan halaman Home

Titlebar disisakan nama aplikasi dan dua tombol jendela; status gateway yang
sebelumnya muncul di tiga tempat kini hanya di kaki sidebar. Sidebar dipisah
jadi halaman dalam aplikasi dan pintasan jendela lain. Halaman Home dipindah ke
HomeControlPanel berisi tiga notifikasi terbaru, menggantikan kartu identitas,
kartu portal, dan dua kotak bento yang mengulang isi yang sama.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: History, Settings, dan dialog konfirmasi

**Files:**
- Create: `apps/sja-notification-app/AppDialogs.cs`
- Modify: `apps/sja-notification-app/HistoryControlPanel.cs`, `apps/sja-notification-app/SettingsControlPanel.cs`, `apps/sja-notification-app/TrayApplicationContext.cs` (dua konfirmasi), `apps/sja-notification-app/MainWindowForm.cs` (satu konfirmasi)

**Interfaces:**
- Consumes: token Task 1, kontrol Task 5.
- Produces:
  ```csharp
  public static class AppDialogs
  {
      public static bool Confirm(IWin32Window? owner, string title, string body,
                                 string confirmLabel, string cancelLabel = "Cancel",
                                 bool isDestructive = false);
  }
  ```
  Mengembalikan `true` bila pengguna menekan tombol konfirmasi.

- [ ] **Step 1: Buat `AppDialogs.cs`**

Buat `apps/sja-notification-app/AppDialogs.cs`:

```csharp
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace SJANotificationApp
{
    /// <summary>
    /// Dialog konfirmasi beringkai aplikasi, menggantikan MessageBox untuk
    /// keputusan pengguna. MessageBox tetap dipakai untuk galat sistem.
    /// </summary>
    public static class AppDialogs
    {
        public static bool Confirm(IWin32Window? owner, string title, string body,
                                   string confirmLabel, string cancelLabel = "Cancel",
                                   bool isDestructive = false)
        {
            using var dlg = new ConfirmDialogForm(title, body, confirmLabel, cancelLabel, isDestructive);
            return owner != null
                ? dlg.ShowDialog(owner) == DialogResult.OK
                : dlg.ShowDialog() == DialogResult.OK;
        }

        private sealed class ConfirmDialogForm : Form
        {
            public ConfirmDialogForm(string title, string body, string confirmLabel,
                                     string cancelLabel, bool isDestructive)
            {
                FormBorderStyle = FormBorderStyle.None;
                StartPosition = FormStartPosition.CenterParent;
                ShowInTaskbar = false;
                DoubleBuffered = true;
                Size = new Size(380, 160);
                BackColor = FluentTheme.ThemeSurface;

                var lblTitle = new Label
                {
                    Text = title,
                    Font = FluentTheme.GetFont(12F, FontStyle.Bold),
                    ForeColor = FluentTheme.ThemeTextPrimary,
                    Location = new Point(20, 18),
                    Size = new Size(340, 24),
                    AutoEllipsis = true
                };
                Controls.Add(lblTitle);

                var lblBody = new Label
                {
                    Text = body,
                    Font = FluentTheme.Caption,
                    ForeColor = FluentTheme.ThemeTextSecondary,
                    Location = new Point(20, 46),
                    Size = new Size(340, 52)
                };
                Controls.Add(lblBody);

                var btnCancel = new GlassButton
                {
                    Text = cancelLabel,
                    Variant = GlassButtonVariant.Ghost,
                    Font = FluentTheme.CaptionBold,
                    Radius = 8,
                    Size = new Size(92, 32),
                    Location = new Point(ClientSize.Width - 204, ClientSize.Height - 44)
                };
                btnCancel.Click += (s, e) => { DialogResult = DialogResult.Cancel; Close(); };
                Controls.Add(btnCancel);

                var btnConfirm = new GlassButton
                {
                    Text = confirmLabel,
                    Variant = isDestructive ? GlassButtonVariant.Danger : GlassButtonVariant.Primary,
                    Font = FluentTheme.CaptionBold,
                    Radius = 8,
                    Size = new Size(96, 32),
                    Location = new Point(ClientSize.Width - 104, ClientSize.Height - 44)
                };
                btnConfirm.Click += (s, e) => { DialogResult = DialogResult.OK; Close(); };
                Controls.Add(btnConfirm);

                AcceptButton = btnConfirm;
                CancelButton = btnCancel;
            }

            protected override void OnPaint(PaintEventArgs e)
            {
                base.OnPaint(e);
                var g = e.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using var p = new Pen(FluentTheme.ThemeCardHairlineStrong, 1f);
                FluentTheme.DrawRoundedRectangle(g, p, new Rectangle(0, 0, ClientSize.Width - 1, ClientSize.Height - 1), 12);
            }
        }
    }
}
```

- [ ] **Step 2: Tulis test**

Buat `apps/sja-notification-app-tests/AppDialogsTests.cs`:

```csharp
using SJANotificationApp;
using Xunit;

namespace SJANotificationApp.Tests
{
    public class AppDialogsTests
    {
        [Fact]
        public void ConfirmMethod_Exists_WithExpectedSignature()
        {
            var m = typeof(AppDialogs).GetMethod("Confirm");
            Assert.NotNull(m);
            Assert.Equal(typeof(bool), m!.ReturnType);

            var p = m.GetParameters();
            Assert.Equal(6, p.Length);
            Assert.Equal("owner", p[0].Name);
            Assert.Equal("title", p[1].Name);
            Assert.Equal("body", p[2].Name);
            Assert.Equal("confirmLabel", p[3].Name);
            Assert.Equal("cancelLabel", p[4].Name);
            Assert.Equal("isDestructive", p[5].Name);
        }
    }
}
```

Dialog modal tidak diuji dengan membukanya — test hanya mengunci kontraknya.

- [ ] **Step 3: History — kepadatan, label, kondisi kosong**

Di `HistoryControlPanel.cs`:
- Tinggi baris `NotificationStreamCanvas` **84 → 72**, jarak 8 tetap. Cari konstantanya lebih dulu: `grep -n "84\|RowHeight\|rowHeight" HistoryControlPanel.cs`.
- Hapus chip abu-abu pada setiap baris; prioritas ditandai hanya lewat `GetPriorityTheme` saat bermakna.
- Label: `Bersihkan` → `Clear all`, `Segarkan` → `Refresh`.
- Kondisi kosong (`:451-480`): teks Inggris, memakai ikon `history` dari `GetMenuIcon`.
- Klik baris (`:187-209`) **tidak diubah** — tetap membuka browser lewat rantai fallback yang ada.

- [ ] **Step 4: Settings — daftar berkelompok**

Di `SettingsControlPanel.cs`, susun ulang jadi satu daftar panjang berkelompok, label kiri dan kontrol kanan, tanpa tab. Nama kelompok:
- `TAMPILAN & TEMA` (`:100`) → `Appearance`
- `NOTIFIKASI & SUARA` (`:160`) → `Notifications & sound`
- `SISTEM & JARINGAN` (`:307`) → `System & network`

Terjemahkan label baris, termasuk `Mulai Otomatis Bersama Windows` (`:322`) → `Start with Windows` dan `Tes Nada` (`:281-292`) → `Test sound`. Tombol simpan (`:397`) → `Save changes`.

- [ ] **Step 5: Ganti empat `MessageBox` konfirmasi**

| Lokasi | Judul | Isi | Tombol |
|---|---|---|---|
| `HistoryControlPanel.cs:84` | `Clear notification history?` | `All saved notifications will be removed from this device. This cannot be undone.` | `Clear all` (destructive) |
| `MainWindowForm.cs:1697` | `Sign out?` | `You will need to sign in again to receive notifications on this device.` | `Sign out` (destructive) |
| `TrayApplicationContext.cs:606` | `Sign out?` | `You will need to sign in again to receive notifications on this device.` | `Sign out` (destructive) |
| `TrayApplicationContext.cs:625` | `Quit notifier?` | `You will stop receiving notifications until the app is started again.` | `Quit` (destructive) |

Contoh penggantian:

```csharp
            if (!AppDialogs.Confirm(this,
                    "Clear notification history?",
                    "All saved notifications will be removed from this device. This cannot be undone.",
                    "Clear all",
                    isDestructive: true))
            {
                return;
            }
```

`MessageBox` untuk galat sistem dan persetujuan transfer file (`TrayApplicationContext.cs:85-90`) **tidak diganti**.

- [ ] **Step 6: Build, render, uji**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
pwsh -File scripts/render-previews.ps1
```

Expected: 66 test lulus.

- [ ] **Step 7: Uji manual konfirmasi**

Jalankan aplikasi. Buka History → `Clear all` → pastikan dialog beringkai aplikasi muncul, `Cancel` tidak menghapus, `Clear all` menghapus. Ulangi untuk sign out dari jendela dan dari tray.

- [ ] **Step 8: Commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/sja-notification-app/AppDialogs.cs apps/sja-notification-app/HistoryControlPanel.cs apps/sja-notification-app/SettingsControlPanel.cs apps/sja-notification-app/TrayApplicationContext.cs apps/sja-notification-app/MainWindowForm.cs apps/sja-notification-app-tests/AppDialogsTests.cs
git commit -m "$(cat <<'EOF'
feat(sja-notifier): dialog konfirmasi beringkai aplikasi, History dan Settings

Empat konfirmasi berpindah dari MessageBox ke dialog yang sebingkai dengan
aplikasi; MessageBox untuk galat sistem dan persetujuan transfer file tetap.
Baris riwayat dirapatkan ke 72px dan chip abu-abu per baris dihapus. Settings
jadi satu daftar berkelompok.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Remote — device browser

**Files:**
- Modify: `apps/sja-notification-app/RemoteDeviceBrowserForm.cs` (11 literal warna, kondisi gagal-muat, label), `apps/sja-notification-app/MainWindowForm.cs:1558,1584` (pesan gerbang)

**Interfaces:**
- Consumes: token Task 1, ikon Task 4, konstanta `RemoteAccessDeniedMessage` Task 8.
- Produces: `RemoteDeviceBrowserForm(AppConfig)` dan `SeedMockDevices()` — tanda tangan tidak berubah (harness `Program.cs:259,263` bergantung padanya).

- [ ] **Step 1: Ganti 11 literal warna**

Semua di `:301-308`, `:614-618`, `:664-665`. Nilai-nilai itu Tailwind emerald-500 dan slate-400.

| Baris | Peran | Token |
|---|---|---|
| 301-302 | latar pil status | `ThemeStatusOnlineBg` / `ThemeStatusOfflineBg` |
| 304-305 | tepi pil status | `Color.FromArgb(64, FluentTheme.ThemeStatusOnline)` / `...ThemeStatusCritical` |
| 308 | teks pil | `ThemeStatusOnline` / `ThemeStatusCritical` |
| 614-615 | latar avatar | `ThemeStatusOnlineBg` / `ThemeSurfaceSoft` |
| 617-618 | tepi avatar | `Color.FromArgb(48, FluentTheme.ThemeStatusOnline)` / `ThemeCardHairline` |
| 664-665 | badge site | `ThemeTextSecondary` / `ThemeSurfaceSoft` |

- [ ] **Step 2: Gambar kondisi gagal-muat**

Saat ini kegagalan hanya masuk log (`:490`) dan layar tetap kosong tanpa keterangan. Tambahkan state ketiga di samping "ada perangkat" dan "tidak ada hasil".

Di `RenderCards()` (`:526-587`), tambahkan cabang untuk `_loadFailed`:

```csharp
            if (_loadFailed)
            {
                RenderStatePanel(
                    iconKey: "warning",
                    title: "Could not load devices",
                    body: "Check your connection to the SJA server, then try again.",
                    actionLabel: "Try again",
                    onAction: async () => await LoadDevicesAsync());
                return;
            }
```

Tambahkan field `private bool _loadFailed;`, set `true` di blok catch (`:490`) dan `false` di awal setiap pemuatan. Ekstrak bingkai kosong yang ada (`:534-563`) menjadi helper `RenderStatePanel(...)` sehingga "tidak ada hasil" dan "gagal muat" memakai bingkai yang sama — DRY, dan keduanya otomatis konsisten.

Verifikasi nama metode pemuatan sebenarnya lebih dulu:

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app"
grep -n "private.*Task.*Load\|async Task" RemoteDeviceBrowserForm.cs
```

- [ ] **Step 3: Satukan pesan gerbang akses**

`RemoteDeviceBrowserForm.cs:118` melempar `UnauthorizedAccessException`, yang ditangkap di `MainWindowForm.cs:1572-1576` dan sampai ke pengguna berawalan `"Gagal membuka browser perangkat:"`.

Perbaikan: di `MainWindowForm.OpenRemoteDeviceBrowser()`, tangkap `UnauthorizedAccessException` secara terpisah dan tampilkan pesannya apa adanya:

```csharp
            catch (UnauthorizedAccessException)
            {
                ShowAlert(RemoteAccessDeniedMessage, isError: true);
                return;
            }
            catch (Exception ex)
            {
                ShowAlert($"Could not open the device browser: {ex.Message}", isError: true);
                return;
            }
```

Ganti pesan di `:1558` dan `:1584` dengan konstanta `RemoteAccessDeniedMessage` (Task 8 Step 3). `RemoteAccessPolicy.cs` **tidak disentuh**.

- [ ] **Step 4: Terjemahkan label**

| Sekarang | Menjadi |
|---|---|
| `SJA Remote Desktop • Direktori Perangkat Santos` | `SJA Remote Desktop` |
| `SJA Remote Desktop • Direktori Perangkat` | `Remote Desktop` |
| `Tutup (Esc)` | `Close (Esc)` |
| `Cari nama PC, NIK, nama karyawan, atau alamat IP...` | `Search by PC name, employee ID, name, or IP address` |
| `Semua Site (ALL)` | `All sites` |
| `SPJ (Sepanjang)` | `SPJ — Sepanjang` |
| `KRW (Karawang)` | `KRW — Karawang` |
| `JTB (Jatake)` | `JTB — Jatake` |
| `SMG (Semarang)` | `SMG — Semarang` |
| `Segarkan` | `Refresh` |
| `Tidak ada perangkat yang cocok...` | `No devices match your search. Try a different keyword or site filter.` |
| `Aktif Sekarang` | `Active now` |
| `Terakhir: {x}` | `Last seen: {x}` |
| `Karyawan: {n} ({id})` | `Employee: {n} ({id})` |
| `Mulai Remote` | `Connect` |
| `Offline` | `Offline` |
| `Fitur Remote Desktop hanya tersedia...` | `Remote Desktop is available to Admin and Agent accounts only.` |
| `{n} Online • {m} Perangkat` | `{n} online • {m} devices` |

Nama site (Sepanjang, Karawang, Jatake, Semarang) adalah nama tempat — tidak diterjemahkan.

Data contoh `SeedMockDevices` (`:63-111`) berisi `"1 menit lalu"`, `"Baru saja"`, `"2 jam lalu"` — terjemahkan jadi `"1 minute ago"`, `"Just now"`, `"2 hours ago"` karena itu teks yang dibuat aplikasi, bukan dari server.

- [ ] **Step 5: Build, render, uji**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app/bin/Debug/net10.0-windows10.0.19041.0"
./SJANotifier.exe --test-render-remote light
./SJANotifier.exe --test-render-remote dark
```

Periksa: hijau online kini satu nilai dengan aplikasi, seluruh label Inggris, pil status terbaca di dua tema.

- [ ] **Step 6: Uji gerbang peran**

Ini gerbang izin — harus diuji, bukan diasumsikan. Jalankan aplikasi dengan akun non-operator dan pastikan: menekan `Remote Desktop` di sidebar memunculkan pesan `Remote Desktop is available to Admin and Agent accounts only.` **tanpa** awalan "Could not open", dan browser perangkat tidak terbuka.

- [ ] **Step 7: Commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/sja-notification-app/RemoteDeviceBrowserForm.cs apps/sja-notification-app/MainWindowForm.cs
git commit -m "$(cat <<'EOF'
refactor(sja-notifier): selaraskan browser perangkat remote dengan token aplikasi

Sebelas literal Tailwind diganti token sehingga hijau online tidak lagi berbeda
dari sisa aplikasi. Kegagalan memuat perangkat kini digambar dengan keterangan
dan tombol coba lagi, bukan hanya masuk log. Pesan gerbang akses disatukan jadi
satu redaksi dan tampil tanpa awalan kegagalan.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Remote — viewer dan privacy overlay

**Files:**
- Modify: `apps/sja-notification-app/RemoteViewerForm.cs`, `apps/sja-notification-app/RemotePrivacyOverlayForm.cs`

**Interfaces:**
- Consumes: token Task 1, ikon Task 4.
- Produces:
  - `RemoteViewerForm` — tanda tangan konstruktor tidak berubah.
  - `enum RemoteSessionState { Requesting, Authenticating, AwaitingConsent, Connecting, Connected, Disconnected, Failed }` di `RemoteViewerForm.cs`.
  - `RemotePrivacyOverlayForm` — tanda tangan konstruktor tidak berubah.

- [ ] **Step 1: Perbaiki kaca jendela ganda**

`RemoteViewerForm.cs:83` memakai `FormBorderStyle.Sizable` sementara `:125-190` menggambar titlebar sendiri — dua baris tombol terlihat bersamaan.

Ganti `:83` menjadi:

```csharp
            FormBorderStyle = FormBorderStyle.None;
```

Lalu salin pola tepi resize yang sudah terbukti dari `MainWindowForm.cs:1847-1885` ke `RemoteViewerForm`:

```csharp
        private const int WM_NCHITTEST = 0x84;
        private const int HTCLIENT = 1;
        private const int HTLEFT = 10;
        private const int HTRIGHT = 11;
        private const int HTTOP = 12;
        private const int HTTOPLEFT = 13;
        private const int HTTOPRIGHT = 14;
        private const int HTBOTTOM = 15;
        private const int HTBOTTOMLEFT = 16;
        private const int HTBOTTOMRIGHT = 17;

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_NCHITTEST && !_isFullscreen)
            {
                base.WndProc(ref m);
                if (m.Result.ToInt32() == HTCLIENT)
                {
                    Point pt = PointToClient(new Point(m.LParam.ToInt32() & 0xFFFF, m.LParam.ToInt32() >> 16));
                    int border = 6;
                    bool left = pt.X <= border;
                    bool right = pt.X >= ClientSize.Width - border;
                    bool top = pt.Y <= border;
                    bool bottom = pt.Y >= ClientSize.Height - border;

                    if (top && left) m.Result = (IntPtr)HTTOPLEFT;
                    else if (top && right) m.Result = (IntPtr)HTTOPRIGHT;
                    else if (bottom && left) m.Result = (IntPtr)HTBOTTOMLEFT;
                    else if (bottom && right) m.Result = (IntPtr)HTBOTTOMRIGHT;
                    else if (left) m.Result = (IntPtr)HTLEFT;
                    else if (right) m.Result = (IntPtr)HTRIGHT;
                    else if (top) m.Result = (IntPtr)HTTOP;
                    else if (bottom) m.Result = (IntPtr)HTBOTTOM;
                }
                return;
            }
            base.WndProc(ref m);
        }
```

Tambahkan field `private bool _isFullscreen;` dan set di `ToggleFullscreen` (`:236-259`). Karena `FormBorderStyle` kini sudah `None`, baris `:244` yang mengubahnya ke `None` menjadi mubazir — hapus, dan `:253` yang memulihkan ke `Sizable` juga dihapus. Fullscreen cukup mengganti `WindowState` dan menyembunyikan chrome.

- [ ] **Step 2: Pisahkan titlebar dari toolbar sesi**

Titlebar (tinggi 52 → 44): nama perangkat di kiri, `minimize` / `maximize` / `close` di kanan memakai `GetMenuIcon`.

Toolbar sesi jadi baris terpisah di bawah titlebar, `Dock = Top`, tinggi 44, latar `ThemeCardFillSoft`. Isinya, dengan lebar mengikuti teks (`AutoSize` atau `TextRenderer.MeasureText`), bukan lebar mati:

- `Fullscreen` — tombol netral
- `Send file` — tombol netral, `Enabled = false` sampai sesi aktif (perilaku sama seperti `:168-174`)
- `Disconnect` — tombol destructive, `ThemeStatusCritical`
- Segmented control `Overlay`: `Full` | `Small` (menggantikan tombol berlabel berubah di `:176-181`)
- Segmented control `Content`: `Image` | `Video` (menggantikan `:183-188`)

Hapus seluruh penempatan berbasis `Width - N` di `:127-204` dan gantikan dengan `FlowLayoutPanel` atau perhitungan berurutan dari kiri.

- [ ] **Step 3: Pisahkan status dari teks tampilan**

`:513` bercabang lewat `_lblStatus.Text.StartsWith("🟡")`. Setelah diterjemahkan, cabang itu tidak pernah kena lagi — ini merusak fungsi, bukan sekadar tampilan.

Tambahkan di `RemoteViewerForm.cs`:

```csharp
    public enum RemoteSessionState
    {
        Requesting,
        Authenticating,
        AwaitingConsent,
        Connecting,
        Connected,
        Disconnected,
        Failed
    }
```

Tambahkan field `private RemoteSessionState _state = RemoteSessionState.Requesting;` dan satu metode:

```csharp
        private void SetState(RemoteSessionState state, string? detail = null)
        {
            _state = state;

            (string text, Color color) = state switch
            {
                RemoteSessionState.Requesting      => ("Requesting a secure session…", FluentTheme.ThemeTextSecondary),
                RemoteSessionState.Authenticating  => ("Authenticating…", FluentTheme.ThemeTextSecondary),
                RemoteSessionState.AwaitingConsent => ("Waiting for the user to accept", FluentTheme.ThemeStatusWarn),
                RemoteSessionState.Connecting      => ("Connecting…", FluentTheme.ThemeTextSecondary),
                RemoteSessionState.Connected       => ("Connected", FluentTheme.ThemeStatusOnline),
                RemoteSessionState.Disconnected    => ("Disconnected", FluentTheme.ThemeStatusCritical),
                RemoteSessionState.Failed          => ("Connection failed", FluentTheme.ThemeStatusCritical),
                _                                  => ("", FluentTheme.ThemeTextSecondary)
            };

            _lblStatus.Text = string.IsNullOrEmpty(detail) ? text : $"{text} — {detail}";
            _lblStatus.ForeColor = color;
        }
```

Ganti **setiap** penulisan `_lblStatus.Text = ...` (sekitar 20 tempat, daftar lengkap ada di §5.2 spec) dengan `SetState(...)`. Ganti cabang `:513` dari membaca teks menjadi `if (_state == RemoteSessionState.AwaitingConsent)`.

Emoji 🟡🟢🔴✓ dibuang — status dibedakan lewat warna dan kata.

**Alur koneksi, autentikasi, dan transfer file tidak disentuh** — hanya cara status ditampilkan.

- [ ] **Step 4: Ganti 6 literal warna viewer**

| Baris | Sekarang | Token |
|---|---|---|
| 86 | `18,20,24` | `ThemeTokens.DarkCanvas` lewat properti baru (lihat di bawah) |
| 87 | `Color.White` | teks utama gelap |
| 103 | `24,26,32` | latar chrome gelap |
| 111 | `Color.White` | teks utama gelap |
| 120 | `156,163,175` | teks sekunder gelap |
| 212 | `Color.Black` | tetap hitam — ini latar video, bukan warna antarmuka |

Viewer tetap gelap permanen. Agar tetap memakai token tanpa bergantung tema aktif, tambahkan di `FluentTheme.cs`:

```csharp
        // ---- Token gelap tetap, untuk permukaan yang selalu gelap (viewer remote) ----
        public static Color FixedDarkCanvas => ThemeTokens.DarkCanvas;
        public static Color FixedDarkSurface => ThemeTokens.DarkSurface;
        public static Color FixedDarkTextPrimary => ThemeTokens.DarkTextPrimary;
        public static Color FixedDarkTextSecondary => ThemeTokens.DarkTextSecondary;
        public static Color FixedDarkHairline => ThemeTokens.DarkHairline;
        public static Color FixedDarkOnline => ThemeTokens.DarkOnline;
        public static Color FixedDarkWarn => ThemeTokens.DarkWarn;
        public static Color FixedDarkCritical => ThemeTokens.DarkCritical;
```

Di `SetState` (Step 3), gunakan token gelap tetap ini agar status terbaca kontras di atas dasar gelap viewer:
- `RemoteSessionState.Connected` => `FluentTheme.FixedDarkOnline`
- `RemoteSessionState.AwaitingConsent` => `FluentTheme.FixedDarkWarn`
- `RemoteSessionState.Disconnected` / `Failed` => `FluentTheme.FixedDarkCritical`
- State lainnya => `FluentTheme.FixedDarkTextSecondary`

- [ ] **Step 5: Terjemahkan label viewer**

Seluruh 30+ string di `RemoteViewerForm.cs` (daftar lengkap di §5.2 spec). Termasuk `OpenFileDialog.Title` (`:746`) → `Choose a file to send`, `Filter` (`:747`) → `All files (*.*)|*.*`, dan satuan `FormatBytes` (`:816-819`) yang sudah GB/MB/KB/B — biarkan.

- [ ] **Step 6: Privacy overlay — 15 literal warna dan font**

Ganti seluruh literal di `RemotePrivacyOverlayForm.cs:112-227` dengan token `Fixed*` (overlay juga selalu gelap). `:112` yang menuliskan ulang nilai `NavyBrand` memakai `FluentTheme.NavyBrand`.

Ganti tiga `new Font("Segoe UI", ...)` (`:125-127`) dengan `FluentTheme.GetFont(30f, FontStyle.Bold)`, `GetFont(15f)`, `GetFont(12f)`.

Perbaiki kebocoran `Font` di `:199-253`: setiap `FluentTheme.Body` mengalokasikan `Font` baru lalu hanya `.FontFamily` diambil. Ganti pola `new Font(FluentTheme.Body.FontFamily, 20f, FontStyle.Bold)` menjadi `FluentTheme.GetFont(20f, FontStyle.Bold)`.

- [ ] **Step 7: Buang slideshow Unsplash**

Hapus lima URL di `:84-88`. Ganti isi array menjadi kosong, dan biarkan mekanisme slideshow serta timer 5 detik (`:452-459`) tetap ada — bila array kosong, tampilkan gambar pelindung hasil `GenerateCorporateOfflineShieldImage` (`:102-138`) dan jangan jalankan timer.

```csharp
        // Materi slideshow internal perusahaan. Kosong = pakai gambar pelindung bawaan.
        // Diisi dari berkas lokal, bukan dari internet.
        private static readonly string[] SlideImagePaths = Array.Empty<string>();
```

Sesuaikan pemuat gambar agar membaca berkas lokal, bukan mengunduh. Bila pemuatnya memakai `HttpClient`, hapus pemanggilan jaringannya.

- [ ] **Step 8: Lepas `AcceptButton`**

Hapus `RemotePrivacyOverlayForm.cs:243`:

```csharp
            AcceptButton = _btnAllowNow;   // ← hapus baris ini
```

Persetujuan kini hanya lewat klik. **Hitungan mundur yang otomatis memberi izin saat habis (`:476`) tidak diubah.**

- [ ] **Step 9: Perbaiki lebar tombol yang ditambal**

`:321-322` menambal lebar tombol jadi 300 untuk label pasca-persetujuan. Ganti dengan lebar mengikuti teks:

```csharp
            _btnDisconnect.Width = TextRenderer.MeasureText(_btnDisconnect.Text, _btnDisconnect.Font).Width + 48;
```

Terapkan pola sama pada `:247` dan `:472` yang menyusun ulang teks dengan sisipan detik.

- [ ] **Step 10: Terjemahkan label overlay**

| Sekarang | Menjadi |
|---|---|
| `PERMINTAAN BANTUAN REMOTE SANTOS ICT` | `Santos ICT remote assistance request` |
| `SESI BANTUAN REMOTE AKTIF` | `Remote assistance session active` |
| `Petugas: {n} • Alamat IP: {ip}` | `Technician: {n} • IP address: {ip}` |
| `Petugas meminta izin mengendalikan komputer ini.` | `A technician is requesting control of this computer.` |
| `Petugas sedang mengendalikan komputer ini. Anda tetap bisa melihat layarnya.` | `A technician is controlling this computer. You can still see the screen.` |
| `IZINKAN SEKARANG` | `Allow now` |
| `TOLAK AKSES ({n}s)` | `Deny access ({n}s)` |
| `PUTUSKAN SESI REMOTE` | `End remote session` |
| `Layar kerja Anda terproteksi...` | `Your screen is shielded from onlookers during this support session.` |

`PT SANTOS JAYA ABADI` tetap — itu nama perusahaan.

Huruf kapital penuh diganti kapitalisasi kalimat; penekanan dilakukan lewat ukuran dan bobot, bukan caps lock.

- [ ] **Step 11: Build, render, uji**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app/bin/Debug/net10.0-windows10.0.19041.0"
./SJANotifier.exe --test-render-remote-viewer dark
./SJANotifier.exe --test-render-remote-privacy dark
```

Periksa viewer: **hanya satu baris tombol jendela**, toolbar sesi terpisah di bawahnya, tidak ada tombol bertabrakan.

- [ ] **Step 12: Uji manual sesi remote**

Ini menyentuh gerbang persetujuan — wajib diuji sungguhan, tidak boleh diasumsikan:

1. Mulai sesi remote dari akun operator. Viewer terbuka, status berpindah sesuai keadaan, tidak ada dua set tombol jendela, jendela bisa di-resize dari tepi.
2. Di sisi target, overlay privasi muncul. **Tekan Enter — izin TIDAK boleh diberikan.** Klik `Allow now` → izin diberikan.
3. Biarkan hitungan mundur habis pada percobaan terpisah → izin otomatis diberikan (perilaku lama, sengaja dipertahankan).
4. Click-through masih bekerja: klik di area layar overlay tembus ke aplikasi di bawahnya; klik di bar bawah tetap mengenai tombol.
5. Kirim satu file → dialog persetujuan muncul, file tersimpan di Downloads.
6. Fullscreen (F11) → toolbar tersembunyi, kembali normal saat keluar.

- [ ] **Step 13: Commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add apps/sja-notification-app/RemoteViewerForm.cs apps/sja-notification-app/RemotePrivacyOverlayForm.cs apps/sja-notification-app/FluentTheme.cs
git commit -m "$(cat <<'EOF'
refactor(sja-notifier): selaraskan viewer dan privacy overlay remote

Viewer berhenti menampilkan dua set tombol jendela: kaca bawaan Windows diganti
titlebar aplikasi dengan tepi resize sendiri, dan aksi sesi turun ke toolbar
terpisah dengan lebar mengikuti teks. Status sesi dipisah jadi enum sehingga
logika tidak lagi membaca teks tampilan yang akan ikut berubah saat
diterjemahkan.

Privacy overlay berhenti mengunduh foto stok dari internet dan memakai gambar
pelindung yang digambar sendiri; mekanisme slideshow dipertahankan untuk materi
internal. AcceptButton dilepas sehingga menekan Enter tidak lagi langsung
memberi kendali komputer. Hitungan mundur otomatis tidak diubah.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Hapus form lama dan alias sementara

Task penutup. Semua pemanggil sudah dimigrasi di Task 5–11.

**Files:**
- Delete: `apps/sja-notification-app/HistoryForm.cs`, `apps/sja-notification-app/SettingsForm.cs`, `apps/sja-notification-app/LoginForm.cs`
- Modify: `apps/sja-notification-app/FluentTheme.cs` (hapus blok alias sementara Task 1 Step 6)

**Interfaces:**
- Consumes: seluruh task sebelumnya.
- Produces: —

- [ ] **Step 1: Pastikan tidak ada referensi tersisa**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app"
grep -rn "HistoryForm\|SettingsForm\|LoginForm" *.cs ../sja-notification-app-tests/*.cs
```

Expected: hanya baris di dalam ketiga berkas itu sendiri. Bila ada referensi dari berkas lain, perbaiki dulu — jangan hapus.

- [ ] **Step 2: Hapus ketiga berkas**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git rm apps/sja-notification-app/HistoryForm.cs apps/sja-notification-app/SettingsForm.cs apps/sja-notification-app/LoginForm.cs
```

- [ ] **Step 3: Hapus alias sementara**

Hapus blok "Alias sementara" di `FluentTheme.cs` (ditambahkan di Task 1 Step 6). Build akan gagal untuk setiap pemanggil yang belum dimigrasi — itu justru gunanya.

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
```

Perbaiki setiap error yang muncul dengan mengganti ke token yang benar (tabel pemetaan Task 5 Step 2). Jangan mengembalikan aliasnya.

- [ ] **Step 4: Verifikasi tidak ada literal warna tersisa di berkas form**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app"
for f in *.cs; do
  if [ "$f" != "FluentTheme.cs" ] && [ "$f" != "ThemeTokens.cs" ]; then
    n=$(grep -c "Color\.FromArgb([0-9]" "$f")
    if [ "$n" -gt 0 ]; then echo "$n $f"; fi
  fi
done
```

Expected: tidak ada keluaran, kecuali `RemoteViewerForm.cs` untuk `Color.Black` latar video (`:212`) yang memang disengaja. Bentuk `Color.FromArgb(alpha, token)` tidak cocok dengan pola `([0-9]` di atas dan memang diizinkan.

- [ ] **Step 5: Verifikasi tidak ada font literal tersisa**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps/sja-notification-app"
grep -rn 'new Font("' *.cs
```

Expected: hanya `FluentTheme.cs:248` di dalam `GetBestFontFamily` (pengujian ketersediaan family) dan `:261` di `GetFont`.

- [ ] **Step 6: Uji lengkap**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main/apps"
dotnet build sja-notification-app/SJANotificationApp.csproj -v q --nologo
dotnet test sja-notification-app-tests/SJANotificationApp.Tests.csproj -v q --nologo
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
pwsh -File scripts/render-previews.ps1
```

Expected: build sukses, 66 test lulus, 20 PNG tersimpan.

- [ ] **Step 7: Uji regresi manual**

Daftar dari §7 spec — jalankan seluruhnya:

- Aplikasi terbuka, setiap halaman tampil, tidak ada exception di log.
- Riwayat termuat; klik baris membuka URL di browser.
- Popup muncul dengan aturan durasi yang sama seperti sebelum redesign.
- Toggle `Start with Windows` masih menulis kunci Run (`HKCU\...\Run`); periksa dengan `reg query`.
- Peralihan tema terang/gelap/ikut-sistem menjangkau semua jendela yang terbuka.
- Tray: setiap item membuka yang benar; menu tidak menutup sendiri saat submenu dibuka.
- Remote: browser perangkat memuat daftar; akun non-operator ditolak dengan pesan yang benar; viewer terhubung; overlay privasi tampil dan click-through bekerja.

- [ ] **Step 8: Commit**

```bash
cd "F:/Program Bagas/SynologyDrive/iDesk-main"
git add -A apps/sja-notification-app
git commit -m "$(cat <<'EOF'
refactor(sja-notifier): hapus form lama dan alias token sementara

HistoryForm dan SettingsForm dihapus karena fungsinya kini jadi halaman di
jendela utama; LoginForm dihapus karena kode mati yang tidak pernah
diinstansiasi. Alias token sementara dicabut sehingga setiap pemanggil wajib
memakai token adaptif.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Verifikasi akhir

Setelah Task 12, seluruh spec harus terpenuhi. Periksa ulang:

| Bagian spec | Task |
|---|---|
| §3.1 Konsolidasi `FluentTheme` | 1, 12 |
| §3.2 Palet | 1 |
| §3.3 Skala | 5, 6, 8, 9 |
| §3.4 Tipografi | 3 |
| §3.5 Ikon | 4 |
| §4.1 Satu jendela tiga halaman | 2, 7, 12 |
| §4.2 Titlebar | 8 |
| §4.3 Sidebar | 8 |
| §4.4 Home | 8 |
| §4.5 History | 9 |
| §4.6 Settings | 9 |
| §4.7 Dropdown | 5 |
| §4.8 Popup | 6 |
| §4.9 Konfirmasi | 9 |
| §5.1 Device browser | 10 |
| §5.2 Viewer | 11 |
| §5.3 Privacy overlay | 11 |
| §6 Bahasa | 7, 8, 9, 10, 11 |
| §7 Harness render | 2 |
