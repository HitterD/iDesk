/**
 * Shared Excel Styling Utilities for Report Generation
 * Centralizes styles to ensure consistency and reduce duplication
 */
import * as ExcelJS from 'exceljs';

// Color palette matching report design system
export const EXCEL_COLORS = {
    primary: 'FF4F46E5',      // Indigo
    primaryLight: 'FFE0E7FF',
    success: 'FF10B981',      // Green
    successLight: 'FFD1FAE5',
    warning: 'FFF59E0B',      // Amber
    warningLight: 'FFFEF3C7',
    danger: 'FFEF4444',       // Red
    dangerLight: 'FFFEE2E2',
    info: 'FF3B82F6',         // Blue
    infoLight: 'FFDBEAFE',
    text: 'FF1F2937',
    textLight: 'FF6B7280',
    white: 'FFFFFFFF',
    gray: 'FF6B7280',
    grayLight: 'FFF3F4F6',
    border: 'FFE5E7EB',
    altRow: 'FFF9FAFB',
};

// Common border style
const thinBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: EXCEL_COLORS.border } };

export const EXCEL_STYLES = {
    /** Header row style - white text on primary background */
    header: {
        font: { name: 'Calibri', size: 12, bold: true, color: { argb: EXCEL_COLORS.white } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: EXCEL_COLORS.primary } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
        border: { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder },
    } as Partial<ExcelJS.Style>,

    /** Standard cell style with borders */
    cell: {
        font: { name: 'Calibri', size: 12 },
        alignment: { vertical: 'middle' as const },
        border: { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder },
    } as Partial<ExcelJS.Style>,

    /** Title cell style - larger bold primary text */
    title: {
        font: { name: 'Calibri', size: 16, bold: true, color: { argb: EXCEL_COLORS.primary } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    } as Partial<ExcelJS.Style>,

    /** Subtitle/date cell style */
    subtitle: {
        font: { name: 'Calibri', size: 10, italic: true, color: { argb: EXCEL_COLORS.textLight } },
        alignment: { horizontal: 'center' as const },
    } as Partial<ExcelJS.Style>,

    /** Section header style */
    sectionHeader: {
        font: { name: 'Calibri', size: 14, bold: true },
    } as Partial<ExcelJS.Style>,
};

/**
 * Apply header style to the first row of a worksheet
 */
export function applyHeaderStyle(sheet: ExcelJS.Worksheet): void {
    const row = sheet.getRow(1);
    row.height = 25;
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
            return { argb: EXCEL_COLORS.success };
        case 'IN_PROGRESS':
            return { argb: EXCEL_COLORS.info };
        case 'CANCELLED':
            return { argb: EXCEL_COLORS.gray };
        default:
            return { argb: EXCEL_COLORS.warning };
    }
}

/**
 * Get cell font color based on priority value
 */
export function getPriorityColor(priority: string): { argb: string } {
    switch (priority.toUpperCase()) {
        case 'CRITICAL':
        case 'URGENT':
            return { argb: EXCEL_COLORS.danger };
        case 'HIGH':
            return { argb: EXCEL_COLORS.warning };
        case 'MEDIUM':
            return { argb: EXCEL_COLORS.info };
        case 'LOW':
            return { argb: EXCEL_COLORS.success };
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
