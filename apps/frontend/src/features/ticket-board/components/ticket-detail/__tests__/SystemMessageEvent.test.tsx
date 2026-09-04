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
        expect(screen.getByText('ANDREW ALFONSO SETIAWAN')).toBeInTheDocument();
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

        expect(screen.getByText('Status: Menunggu Kunjungan Vendor')).toBeInTheDocument();
        expect(screen.getByText('Tiket ini menunggu kunjungan vendor.')).toBeInTheDocument();
        expect(screen.getByText('Setiap hari Kamis')).toBeInTheDocument();
        expect(screen.getByText('Kamis, 3 September 2026')).toBeInTheDocument();
        expect(screen.getByText('ANDREW ALFONSO SETIAWAN')).toBeInTheDocument();
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
        expect(screen.getByText('ANDREW ALFONSO SETIAWAN')).toBeInTheDocument();
    });

    it('renders ticket forwarding correctly', () => {
        render(
            <SystemMessageEvent
                content="System: Ticket forwarded to ORACLE_DEV by ANDREW ALFONSO SETIAWAN"
                createdAt="2026-08-28T07:42:59.000Z"
            />
        );

        expect(screen.getByText(/Tiket Diteruskan ke:/i)).toBeInTheDocument();
        expect(screen.getByText('ORACLE_DEV')).toBeInTheDocument();
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
        expect(screen.getByText('BAGAS')).toBeInTheDocument();
        expect(screen.getByText(/Bukti Foto \/ Lampiran Penyelesaian \(2\)/i)).toBeInTheDocument();
        expect(screen.getByText('Lihat PDF')).toBeInTheDocument();
    });
});
