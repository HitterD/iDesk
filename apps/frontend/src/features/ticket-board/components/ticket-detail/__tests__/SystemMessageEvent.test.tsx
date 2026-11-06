import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SystemMessageEvent } from '../SystemMessageEvent';

describe('SystemMessageEvent Component', () => {
    it('renders status change transition correctly with badges and actor', () => {
        render(
            <SystemMessageEvent
                content="System: Status changed from TODO to WAITING_VENDOR by ANDREW ALFONSO SETIAWAN"
                createdAt="2026-08-28T07:42:59.000Z"
            />
        );

        expect(screen.getByText('Status:')).toBeInTheDocument();
        expect(screen.getByText('Baru (TODO)')).toBeInTheDocument();
        expect(screen.getByText('Menunggu Vendor')).toBeInTheDocument();
        expect(screen.getByText('Andrew Alfonso Setiawan')).toBeInTheDocument();
    });

    it('renders Waiting Vendor rich executive notice card with structured schedule grid', () => {
        const rawContent = `⏳ Status Tiket Diubah ke Waiting Vendor

📋 Tiket ini menunggu kunjungan vendor.
📅 Jadwal vendor datang: Setiap hari Kamis
📆 Perkiraan kunjungan terdekat: Kamis, 3 September 2026

ℹ️ Estimasi waktu tunggu minimal: 1 minggu
👤 Diubah oleh: ANDREW ALFONSO SETIAWAN
🕒 Waktu: 28/8/2026, 07.42.59

---
SLA Timer di-pause selama menunggu vendor.`;

        render(
            <SystemMessageEvent
                content={rawContent}
                createdAt="2026-08-28T07:42:59.000Z"
            />
        );

        expect(screen.getByText('Menunggu kunjungan vendor')).toBeInTheDocument();
        expect(screen.getByText('Tiket ini menunggu kunjungan vendor.')).toBeInTheDocument();
        expect(screen.getByText('Setiap hari Kamis')).toBeInTheDocument();
        expect(screen.getByText('Kamis, 3 September 2026')).toBeInTheDocument();
        expect(screen.getByText('Andrew Alfonso Setiawan')).toBeInTheDocument();
        expect(screen.getByText(/Perhitungan waktu SLA di-pause/i)).toBeInTheDocument();
    });

    it('renders assignment change correctly', () => {
        render(
            <SystemMessageEvent
                content="System: Ticket assigned to BAGAS by ANDREW ALFONSO SETIAWAN"
                createdAt="2026-08-28T07:42:59.000Z"
            />
        );

        expect(screen.getByText(/Penugasan Teknisi:/i)).toBeInTheDocument();
        expect(screen.getByText('BAGAS')).toBeInTheDocument();
        expect(screen.getByText('Andrew Alfonso Setiawan')).toBeInTheDocument();
    });

    it('renders ticket forwarding correctly', () => {
        render(
            <SystemMessageEvent
                content="System: Ticket forwarded to ORACLE_DEV by ANDREW ALFONSO SETIAWAN"
                createdAt="2026-08-28T07:42:59.000Z"
            />
        );

        expect(screen.getByText('Diteruskan ke tim Oracle / K2')).toBeInTheDocument();
        expect(screen.queryByText('ORACLE_DEV')).not.toBeInTheDocument();
    });

    it('renders a team handover as a readable card: teams by name, reason, new SLA, new PIC', () => {
        render(
            <SystemMessageEvent
                content={[
                    'Ticket forwarded from OPS_SUPPORT to ORACLE_DEV. Reason: [Terkait aplikasi Oracle / K2] Error saat posting jurnal',
                    'SLA reset. Target: 2026-08-28T09:00:00.000Z (480 minutes for HIGH)',
                    'Auto-assigned to BUDI SANTOSO (3f0c8a52-1111-4c3e-9d1a-2b7e0f6a9c11)',
                ].join('\n')}
                createdAt="2026-08-28T07:42:59.000Z"
            />
        );

        expect(screen.getByText('Diteruskan ke tim Oracle / K2')).toBeInTheDocument();
        expect(screen.getByText('IT Support')).toBeInTheDocument();
        expect(screen.getByText('Oracle / K2')).toBeInTheDocument();
        expect(screen.getByText('Error saat posting jurnal')).toBeInTheDocument();
        expect(screen.getByText('Terkait aplikasi Oracle / K2')).toBeInTheDocument();
        expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
        expect(screen.getByText(/8 jam/)).toBeInTheDocument();
        // No raw codes, ISO timestamps or ids leak into the card.
        const text = document.body.textContent ?? '';
        expect(text).not.toMatch(/OPS_SUPPORT|ORACLE_DEV|\d{4}-\d{2}-\d{2}T|3f0c8a52/);
    });

    it('splits the reason the forward dialog sends ("<preset>: <note>")', () => {
        render(
            <SystemMessageEvent
                content={'Ticket forwarded from OPS_SUPPORT to MOBILE_DEV by RINA KARTIKA. Reason: Terkait aplikasi Mobile (iOS / Android): Login gagal di Android 14'}
                createdAt="2026-08-28T07:42:59.000Z"
            />
        );

        expect(screen.getByText('Terkait aplikasi Mobile (iOS / Android)')).toBeInTheDocument();
        expect(screen.getByText('Login gagal di Android 14')).toBeInTheDocument();
        expect(screen.getByText('Rina Kartika')).toBeInTheDocument();
    });

    it('tells the requester only which team now handles the ticket', () => {
        render(
            <SystemMessageEvent
                audience="requester"
                content={[
                    'Ticket forwarded from OPS_SUPPORT to WEB_DEV. Reason: Salah routing awal',
                    'SLA reset. Target: 2026-08-28T09:00:00.000Z (480 minutes for HIGH)',
                    'Auto-assign skipped (tidak ada agent yang tersedia untuk modul ini)',
                ].join('\n')}
                createdAt="2026-08-28T07:42:59.000Z"
            />
        );

        expect(screen.getByText('Tiket Anda diteruskan ke tim Web Dev')).toBeInTheDocument();
        expect(screen.queryByText(/Salah routing/)).not.toBeInTheDocument();
        expect(screen.queryByText(/SLA/)).not.toBeInTheDocument();
    });

    it('says the ticket waits for a PIC when no agent was auto-assigned', () => {
        render(
            <SystemMessageEvent
                content={[
                    'Ticket forwarded from ORACLE_DEV to OPS_SUPPORT. Reason: Masalah perangkat',
                    'SLA cleared (ticket not in progress)',
                    'Auto-assign skipped (tidak ada agent yang tersedia untuk modul ini)',
                ].join('\n')}
                createdAt="2026-08-28T07:42:59.000Z"
            />
        );

        expect(screen.getByText('Menunggu PIC dari tim IT Support')).toBeInTheDocument();
        expect(screen.getByText(/SLA dimulai saat tiket dikerjakan/)).toBeInTheDocument();
    });

    it('renders Resolution Statement Card with solution notes and attachments correctly', () => {
        const resolutionContent = `✅ Tiket Dinyatakan Selesai (Resolved)

📌 Tindakan & Solusi:
User account berhasil di-reset dan akses VPN telah diperbarui normal.
Diselesaikan oleh: BAGAS`;

        render(
            <SystemMessageEvent
                content={resolutionContent}
                createdAt="2026-08-28T08:00:00.000Z"
                attachments={['https://example.com/proof1.png', 'https://example.com/report.pdf']}
            />
        );

        expect(screen.getByText('Tiket Dinyatakan Selesai (Resolved)')).toBeInTheDocument();
        expect(screen.getByText(/User account berhasil di-reset dan akses VPN telah diperbarui normal/i)).toBeInTheDocument();
        // Actor names are shown in title case; the assignee value (line 59) stays verbatim.
        expect(screen.getByText('Bagas')).toBeInTheDocument();
        expect(screen.getByText(/Bukti Foto \/ Lampiran Penyelesaian \(2\)/i)).toBeInTheDocument();
        expect(screen.getByText('Lihat PDF')).toBeInTheDocument();
    });

    it('renders clean SLA Extension Apple Sheet Card without emojis', () => {
        const content = `Target SLA Diperpanjang

Deadline Baru: Senin, 21 Sep 2026 15.44 WIB
Kategori Kendala: Menunggu Vendor / Pihak Ketiga
Penjelasan: Menunggu pihak eksternal menyelesaikan perbaikan server
Diperpanjang oleh: System Administrator`;

        render(
            <SystemMessageEvent
                content={content}
                createdAt="2026-09-14T08:00:00.000Z"
            />
        );

        expect(screen.getByText('Target SLA Diperpanjang')).toBeInTheDocument();
        expect(screen.getByText('Target Baru')).toBeInTheDocument();
        expect(screen.getByText('Senin, 21 Sep 2026 15.44 WIB')).toBeInTheDocument();
        expect(screen.getByText('Kategori Kendala')).toBeInTheDocument();
        expect(screen.getByText('Menunggu Vendor / Pihak Ketiga')).toBeInTheDocument();
        expect(screen.getByText('Rincian Kendala')).toBeInTheDocument();
        expect(screen.getByText(/"Menunggu pihak eksternal menyelesaikan perbaikan server"/i)).toBeInTheDocument();
        expect(screen.getByText('System Administrator')).toBeInTheDocument();
    });

    it('sanitizes legacy SLA Extension messages containing emojis and markdown asterisks', () => {
        const legacyContent = `⏱️ **Target SLA Diperpanjang**

📅 **Deadline Baru:** Senin, 21 Sep 2026 15.44 WIB
🏷️ **Kategori Kendala:** Menunggu Vendor / Pihak Ketiga
📝 **Penjelasan:** menunggu pihak external menyelesaikan kendala servernya`;

        render(
            <SystemMessageEvent
                content={legacyContent}
                createdAt="2026-09-14T08:00:00.000Z"
            />
        );

        expect(screen.getByText('Target SLA Diperpanjang')).toBeInTheDocument();
        expect(screen.getByText('Senin, 21 Sep 2026 15.44 WIB')).toBeInTheDocument();
        expect(screen.getByText('Menunggu Vendor / Pihak Ketiga')).toBeInTheDocument();
        expect(screen.getByText(/"menunggu pihak external menyelesaikan kendala servernya"/i)).toBeInTheDocument();
        // Ensure emojis like ⏱️, 📅, 🏷️, 📝 are not rendered in the card
        expect(screen.queryByText(/⏱️/)).toBeNull();
        expect(screen.queryByText(/📅/)).toBeNull();
        expect(screen.queryByText(/🏷️/)).toBeNull();
        expect(screen.queryByText(/📝/)).toBeNull();
    });
});

