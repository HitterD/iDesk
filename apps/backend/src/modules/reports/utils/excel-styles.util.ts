/**
 * Shared Excel Styling Utilities for Report Generation
 * Industrial Utilitarian Design — Muted, professional palette
 */
import * as ExcelJS from 'exceljs';

// ─── COLOR SYSTEM ───────────────────────────────────────────
// Deliberately restrained. No saturated Tailwind primaries.
// Inspired by printed corporate reports, not app UI.
export const EXCEL_COLORS = {
    // Structural
    headerBg: 'FF374151',      // Gray-700 — dark, not branded
    headerText: 'FFFFFFFF',    // White
    subheaderBg: 'FF4B5563',   // Gray-600
    titleText: 'FF111827',     // Gray-900 — near-black
    subtitleText: 'FF9CA3AF',  // Gray-400

    // Content
    text: 'FF1F2937',          // Gray-800
    textMuted: 'FF6B7280',     // Gray-500
    white: 'FFFFFFFF',

    // Borders & Structure
    border: 'FFD1D5DB',        // Gray-300 — visible on print
    borderStrong: 'FF9CA3AF',  // Gray-400 — for header separators
    altRow: 'FFF9FAFB',        // Gray-50 — subtle stripe

    // Semantic — deliberately desaturated for print
    positive: 'FF059669',      // Emerald-600 (dark enough to read)
    caution: 'FFD97706',       // Amber-600
    critical: 'FFDC2626',      // Red-600
    neutral: 'FF2563EB',       // Blue-600
};

// ─── BORDER DEFINITIONS ─────────────────────────────────────
const thinBorder: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: EXCEL_COLORS.border },
};
const mediumBorder: Partial<ExcelJS.Border> = {
    style: 'medium',
    color: { argb: EXCEL_COLORS.borderStrong },
};
const allThinBorders = {
    top: thinBorder,
    left: thinBorder,
    bottom: thinBorder,
    right: thinBorder,
};

// ─── STYLE PRESETS ───────────────────────────────────────────
export const EXCEL_STYLES = {
    /** Table header — dark gray, white text, center-aligned */
    header: {
        font: { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.headerText } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: EXCEL_COLORS.headerBg } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
        border: {
            top: mediumBorder,
            left: thinBorder,
            bottom: mediumBorder,
            right: thinBorder,
        },
    } as Partial<ExcelJS.Style>,

    /** Standard data cell — consistent borders */
    cell: {
        font: { name: 'Calibri', size: 10 },
        alignment: { vertical: 'middle' as const },
        border: allThinBorders,
    } as Partial<ExcelJS.Style>,

    /** Report title — large, dark, no color branding */
    title: {
        font: { name: 'Calibri', size: 14, bold: true, color: { argb: EXCEL_COLORS.titleText } },
        alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
        border: { bottom: mediumBorder },
    } as Partial<ExcelJS.Style>,

    /** Subtitle — generation date, period info */
    subtitle: {
        font: { name: 'Calibri', size: 9, color: { argb: EXCEL_COLORS.subtitleText } },
        alignment: { horizontal: 'left' as const },
    } as Partial<ExcelJS.Style>,

    /** Section divider — bold, left-aligned */
    sectionHeader: {
        font: { name: 'Calibri', size: 11, bold: true, color: { argb: EXCEL_COLORS.titleText } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF3F4F6' } },
        alignment: { vertical: 'middle' as const },
        border: {
            top: mediumBorder,
            left: thinBorder,
            bottom: mediumBorder,
            right: thinBorder,
        },
    } as Partial<ExcelJS.Style>,

    /** Metric label (bold left column in summary tables) */
    metricLabel: {
        font: { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.text } },
        alignment: { vertical: 'middle' as const },
        border: allThinBorders,
    } as Partial<ExcelJS.Style>,
};

// ─── HELPER FUNCTIONS ────────────────────────────────────────

/**
 * Apply header style to the first row of a worksheet
 */
export function applyHeaderStyle(sheet: ExcelJS.Worksheet): void {
    const row = sheet.getRow(1);
    row.height = 24;
    row.eachCell(cell => Object.assign(cell, { style: EXCEL_STYLES.header }));
}

/**
 * Apply standard row styling with alternating background
 */
export function applyRowStyle(row: ExcelJS.Row, idx: number): void {
    row.height = 20;
    row.eachCell(cell => {
        Object.assign(cell, { style: EXCEL_STYLES.cell });
        if (idx % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
        }
    });
}

/**
 * Get cell font color based on status value
 */
export function getStatusColor(status: string): { argb: string } {
    switch (status.toUpperCase()) {
        case 'RESOLVED':
            return { argb: EXCEL_COLORS.positive };
        case 'IN_PROGRESS':
            return { argb: EXCEL_COLORS.neutral };
        case 'CANCELLED':
            return { argb: EXCEL_COLORS.textMuted };
        default:
            return { argb: EXCEL_COLORS.caution };
    }
}

/**
 * Get cell font color based on priority value
 */
export function getPriorityColor(priority: string): { argb: string } {
    switch (priority.toUpperCase()) {
        case 'CRITICAL':
        case 'URGENT':
            return { argb: EXCEL_COLORS.critical };
        case 'HIGH':
            return { argb: EXCEL_COLORS.caution };
        case 'MEDIUM':
            return { argb: EXCEL_COLORS.neutral };
        case 'LOW':
            return { argb: EXCEL_COLORS.positive };
        default:
            return { argb: EXCEL_COLORS.text };
    }
}

/**
 * Month names for date formatting
 */
export const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Create a styled workbook with default metadata
 */
export function createStyledWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'iDesk Helpdesk';
    workbook.created = new Date();
    return workbook;
}

/**
 * Apply full borders to all cells in a range, ensuring empty cells also get borders
 */
export function applyFullBorders(sheet: ExcelJS.Worksheet, startRow: number, endRow: number, maxCol: number): void {
    for (let r = startRow; r <= endRow; r++) {
        const row = sheet.getRow(r);
        for (let c = 1; c <= maxCol; c++) {
            const cell = row.getCell(c);
            if (!cell.border && EXCEL_STYLES.cell.border) {
                cell.border = EXCEL_STYLES.cell.border;
            }
        }
    }
}
