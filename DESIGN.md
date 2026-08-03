---
name: iDesk Design System
description: Modern bento-grid enterprise IT helpdesk system with warm ivory & sapphire tones
colors:
  primary: "#2D4A8C"
  primary-dark: "#5B8AD8"
  accent: "#E8A830"
  neutral-bg: "#F8F6F3"
  neutral-bg-dark: "#101520"
  card-bg: "#FEFDFB"
  card-bg-dark: "#1B212F"
  secondary: "#F0E6D3"
  muted: "#EEECE8"
  border: "#E2DFD9"
  border-dark: "#262D3C"
  destructive: "#D63031"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 700
    lineHeight: "1.1"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "1.25"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5"
  mono:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "#233B70"
  card-bento:
    backgroundColor: "{colors.card-bg}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: iDesk Enterprise Helpdesk

## Overview

**Creative North Star: "The Sapphire Bento Citadel"**

iDesk mengadopsi filosofi visual bento-grid yang rapi, terstruktur, dan berwibawa. Antarmuka dirancang untuk menyajikan data densitas tinggi tanpa terasa sesak, menggabungkan warna dasar Warm Ivory (#F8F6F3) dan Deep Sapphire (#2D4A8C) pada mode terang, serta Deep Navy (#101520) dan Luminous Sapphire (#5B8AD8) pada mode gelap.

Setiap modul dan widget terorganisir dalam modul bento card dengan border halus (1px) dan kurva sudut yang terukur (12px–16px). Interaksi micro-animation memberikan responsivitas instan tanpa mengganggu kecepatan kerja agen IT atau manajemen.

**Key Characteristics:**
- Bento grid layout yang modular dan adaptif
- Palet warna Sapphire & Warm Ivory yang menenangkan dan profesional
- Responsivitas mikro (button feedback scale 0.97, card hover rise -2px)
- Dukungan Dark Mode & Light Mode yang konsisten tanpa kehilangan kontras

## Colors

Palet warna iDesk mengombinasikan warna hangat ivory dengan aksen sapphire dan gold glow untuk keterbacaan tinggi.

### Primary
- **Deep Sapphire** (`#2D4A8C` / `hsl(224 60% 42%)`): Digunakan untuk tombol utama, indikator fokus, navigasi aktif, dan elemen branding utama. Pada dark mode bertransisi menjadi Luminous Sapphire (`#5B8AD8`).

### Secondary
- **Warm Sand** (`#F0E6D3` / `hsl(36 45% 90%)`): Warna latar permukaan sekunder dan chip filter netral.

### Accent
- **Warm Amber** (`#E8A830` / `hsl(36 85% 58%)`): Warna penarik perhatian untuk badge status penting, highlight, dan pembaruan tiket.

### Neutral
- **Warm Ivory Background** (`#F8F6F3` / `hsl(40 20% 97%)`): Warna kanvas utama pada light mode.
- **Deep Navy Background** (`#101520` / `hsl(225 25% 8%)`): Warna kanvas utama pada dark mode.
- **Card Warm Surface** (`#FEFDFB` / `hsl(40 25% 99%)`): Permukaan bento card pada light mode.
- **Card Navy Surface** (`#1B212F` / `hsl(225 20% 15%)`): Permukaan bento card pada dark mode.
- **Warm Border** (`#E2DFD9` / `hsl(40 10% 88%)`): Pemisah permukaan dan garis bento grid.

### Named Rules
**The Rarity Rule.** Aksen Warm Amber (`#E8A830`) hanya digunakan pada maks 5% area layar untuk mempertahankan daya tarik perhatian.
**The Warm Contrast Rule.** Teks utama tidak pernah menggunakan warna hitam pekat `#000000`, melainkan `#282D33` (Warm Dark) pada light mode dan `#E8E4DE` pada dark mode.

## Typography

**Display Font:** Plus Jakarta Sans (fallback: system-ui, -apple-system, sans-serif)  
**Body Font:** Plus Jakarta Sans (fallback: system-ui, -apple-system, sans-serif)  
**Label/Mono Font:** JetBrains Mono (fallback: Fira Code, monospace)  

**Character:** Modern, clean, dan sangat scannable untuk teks helpdesk serta angka analitik.

### Hierarchy
- **Display 2XL** (Bold, 4.5rem, 1.1): Digunakan untuk hero section dan angka statistik utama.
- **Headline H1** (SemiBold, 1.5rem, 1.25): Digunakan untuk judul modul dan nama dashboard.
- **Title H2** (SemiBold, 1.25rem, 1.35): Digunakan untuk judul bento card dan modal header.
- **Body MD** (Regular, 1rem, 1.5): Digunakan untuk konten tiket, balasan chat, dan dokumentasi.
- **Label / Mono** (Medium, 0.875rem, 1.2, uppercase/normal): Digunakan untuk ID tiket (misal: `#TCK-8821`), tag status, dan timestamp.

### Named Rules
**The Monospace Identifier Rule.** Setiap ID tiket, log audit, atau nilai hash wajib menggunakan font JetBrains Mono.

## Layout

Struktur tata letak iDesk berpusat pada bento-grid modular dengan pembatas border 1px dan gap 16px–24px. Sidebar kiri (BentoSidebar) dan header atas (BentoTopbar) bersifat sticky dengan latar translucent (glassmorphism 12px blur).

- **Breakpoint SM:** < 640px (1 kolom bento stack).
- **Breakpoint MD:** 640px – 1024px (2 kolom grid).
- **Breakpoint LG / XL:** > 1024px (Bento grid 3–4 kolom dengan container max 1400px).

## Elevation & Depth

iDesk mengutamakan kedalaman berbasis hirarki warna permukaan (Warm-Tonal Layering). Bayangan bersifat sangat lembut dan hangat.

### Shadow Vocabulary
- **Subtle Surface Shadow** (`0 1px 2px 0 rgba(40, 45, 51, 0.04)`): Elevasi bawaan bento card saat diam.
- **Interactive Card Hover** (`0 12px 32px -8px rgba(40, 45, 51, 0.12)`): Efek angkat saat bento card di-hover (diikuti `translateY(-2px)`).
- **Primary Glow Shadow** (`0 8px 24px -6px hsla(224, 60%, 42%, 0.25)`): Digunakan pada tombol aksi utama (CTA).

### Named Rules
**The Hover Elevation Rule.** Elemen kartu atau tombol tidak menggunakan shadow tebal pada kondisi diam (*at rest*); shadow baru membesar saat kursor diarahkan (*hover*).

## Shapes

- **Base Radius:** 12px (`var(--radius-lg)`) untuk bento card dan kontainer utama.
- **Component Radius:** 8px (`var(--radius-md)`) untuk tombol, input field, dan dropdown.
- **Pill / Badge Radius:** 9999px (`var(--radius-full)`) untuk status indicator badge.

## Components

### Buttons
- **Shape:** Radius 8px (`var(--radius-md)`).
- **Primary:** Background `#2D4A8C`, teks `#FFFFFF`, padding `8px 16px`. Active feedback: `scale(0.97)`.
- **Hover / Focus:** Background `#233B70`, focus ring `0 0 0 3px hsla(224, 60%, 42%, 0.15)`.

### Cards (Bento)
- **Corner Style:** Radius 16px (`var(--radius-xl)`).
- **Background:** `#FEFDFB` (Light) / `#1B212F` (Dark).
- **Border:** 1px solid `#E2DFD9` (Light) / `#262D3C` (Dark).
- **Internal Padding:** 24px (`var(--space-6)`).

### Inputs / Fields
- **Style:** Background `#F8F6F3`, border 1px solid `#E2DFD9`, radius 8px.
- **Focus:** Animation focus-ring 0.3s, shadow `0 0 0 3px hsla(224, 60%, 42%, 0.15)`.

### Status Badges / Chips
- **Style:** Background soft tinted (misal success 50), text dark status (success 500), radius 9999px, padding `4px 12px`, typography JetBrains Mono 0.75rem.

## Do's and Don'ts

### Do:
- **Do** gunakan bento grid dengan gap konsisten (16px/24px) untuk memisahkan antar modul.
- **Do** gunakan font JetBrains Mono untuk semua ID tiket, kode error, dan timestamp.
- **Do** berikan respon visual `scale(0.97)` pada saat tombol diklik.

### Don't:
- **Don't** gunakan warna hitam murni `#000000` atau abu-abu dingin polos tanpa tint hangat/navy.
- **Don't** menumpuk bento card di dalam bento card (*cards nested in cards*).
- **Don't** menggunakan animasi terlalu lambat (>500ms) untuk interaksi biasa.
