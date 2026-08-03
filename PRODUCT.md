# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 18 + Vite + TailwindCSS (Frontend), NestJS 10 + TypeORM + PostgreSQL (Backend)

## Users

- **Client / User**: Karyawan & pengguna internal yang mengajukan tiket support IT, memantau progress tiket, dan memanfaatkan Knowledge Base.
- **Agent & Admin**: Tim IT Helpdesk yang mengelola siklus tiket, papan Kanban, SLA, otomasi workflow, dan konfigurasi sistem.
- **Manager**: Pimpinan IT yang memantau performa helpdesk, laporan analitik eksekutif, dan beban kerja tim (agent workload).

## Product Purpose

Sistem helpdesk dan ticketing IT enterprise full-stack yang mengelola seluruh siklus hidup permintaan support IT dengan integrasi multi-channel (Telegram bot, Zoom calendar booking, Knowledge Base, SLA tracking, dan contract renewal).

## Positioning

Enterprise IT Helpdesk All-in-One yang menggabungkan kemudahan self-service pengguna, manajemen tiket real-time untuk agent IT, dan analitik eksekutif dalam satu platform terintegrasi.

## Operating Context

Lingkungan operasional helpdesk IT perusahaan dengan kebutuhan pemantauan tiket real-time (Socket.IO), penanganan masalah hardware/software, jadwal pemesanan Zoom, serta audit trail dan integrasi multi-channel.

## Capabilities and Constraints

- Terbagi menjadi 3 portal utama: Client Portal (`/client`), Admin/Agent Portal (`/`), dan Manager Portal (`/manager`).
- Real-time updates via Socket.IO WebSocket.
- Integrasi Telegram Bot (Telegraf) dan Zoom Calendar booking.
- Dukungan PWA (Vite PWA) dan export laporan PDF/Excel.

## Brand Commitments

- Modern enterprise bento-grid UI layout.
- Fokus pada kejelasan data (data density), navigasi cepat, dan keandalan sistem enterprise.
- Dukungan penuh untuk Dark Mode & Light Mode (ThemeProvider & TailwindCSS).

## Evidence on Hand

- `docs/iDesk_Blueprint.md` (Dokumentasi teknis & cetak biru arsitektur lengkap).
- `apps/frontend/` (Aplikasi React + Vite + TailwindCSS + Radix UI + Lucide React).
- `apps/backend/` (Service NestJS + TypeORM + PostgreSQL).

## Product Principles

1. **Cohesive Multi-Portal Experience**: Pengalaman yang mulus dan terintegrasi baik untuk Client, Agent, maupun Manager.
2. **High Data Density & Scannability**: Informasi tiket, SLA, dan laporan dapat dibaca dengan cepat tanpa mengorbankan estetika.
3. **Real-time Responsiveness**: Pembaruan status tiket dan notifikasi terjadi secara instan tanpa perlu refresh manual.
4. **Accessible Enterprise Aesthetic**: Desain modern berbasis bento-grid yang rapi, intuitif, dan responsif di berbagai perangkat.

## Accessibility & Inclusion

Dukungan penuh navigasi keyboard, kontras warna rasio WCAG AA (dark/light theme), serta komponen UI berbasis Radix UI untuk aksesibilitas tinggi.
