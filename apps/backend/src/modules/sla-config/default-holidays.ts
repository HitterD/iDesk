/**
 * Seed list for the default business-hours row. After seeding, only the
 * admin-managed `business_hours.holidays` list is used for SLA calculation.
 */
// Indonesian National Holidays for 2025
const INDONESIAN_HOLIDAYS_2025 = [
    // Tahun Baru
    '2025-01-01',
    // Isra Mi'raj
    '2025-01-27',
    // Imlek
    '2025-01-29',
    // Hari Raya Nyepi
    '2025-03-29',
    // Wafat Isa Al-Masih
    '2025-04-18',
    // Hari Raya Idul Fitri (Lebaran)
    '2025-03-31',
    '2025-04-01',
    // Cuti Bersama Lebaran (perkiraan)
    '2025-03-28',
    '2025-04-02',
    '2025-04-03',
    '2025-04-04',
    // Hari Buruh
    '2025-05-01',
    // Kenaikan Isa Al-Masih
    '2025-05-29',
    // Hari Raya Waisak
    '2025-05-12',
    // Pancasila
    '2025-06-01',
    // Hari Raya Idul Adha
    '2025-06-07',
    // Tahun Baru Islam
    '2025-06-27',
    // Hari Kemerdekaan
    '2025-08-17',
    // Maulid Nabi
    '2025-09-05',
    // Natal
    '2025-12-25',
    // Cuti Bersama Natal
    '2025-12-26',
];

// Indonesian National Holidays for 2026

const INDONESIAN_HOLIDAYS_2026 = [
    // Tahun Baru
    '2026-01-01',
    // Imlek
    '2026-02-17',
    // Isra Mi'raj (perkiraan)
    '2026-01-16',
    // Hari Raya Nyepi
    '2026-03-19',
    // Wafat Isa Al-Masih
    '2026-04-03',
    // Hari Raya Idul Fitri
    '2026-03-20',
    '2026-03-21',
    // Hari Buruh
    '2026-05-01',
    // Kenaikan Isa Al-Masih
    '2026-05-14',
    // Hari Raya Waisak
    '2026-05-31',
    // Pancasila
    '2026-06-01',
    // Hari Raya Idul Adha
    '2026-05-27',
    // Tahun Baru Islam
    '2026-06-17',
    // Hari Kemerdekaan
    '2026-08-17',
    // Maulid Nabi
    '2026-08-26',
    // Natal
    '2026-12-25',
];

export const DEFAULT_HOLIDAYS = [...INDONESIAN_HOLIDAYS_2025, ...INDONESIAN_HOLIDAYS_2026];
