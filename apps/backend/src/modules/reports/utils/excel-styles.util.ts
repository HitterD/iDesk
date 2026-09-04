/**
 * Shared Excel Styling Utilities for Report Generation
 * Executive Dashboard & Industrial Utilitarian Design
 * Corporate Santos Jaya Abadi / iDesk Standard
 */
import * as ExcelJS from 'exceljs';

// ─── COLOR SYSTEM ───────────────────────────────────────────
// Professional Executive Palette — Navy, Slate, Cool Grays & Print-Safe Accents
export const EXCEL_COLORS = {
    // Primary / Brand Corporate
    primary: 'FF1E3A8A',       // Blue-900 (Corporate Navy)
    primaryLight: 'FFEFF6FF',  // Blue-50 (Soft tint)
    primaryBorder: 'FFBFDBFE', // Blue-200

    // Structural
    headerBg: 'FF1F2937',      // Gray-800 — Dark header
    headerText: 'FFFFFFFF',    // White
    subheaderBg: 'FF374151',   // Gray-700
    titleText: 'FF0F172A',     // Slate-900 — Bold Title
    subtitleText: 'FF64748B',  // Slate-500

    // Content
    text: 'FF1E293B',          // Slate-800
    textMuted: 'FF64748B',     // Slate-500
    white: 'FFFFFFFF',

    // Card & Containers
    cardBg: 'FFF8FAFC',        // Slate-50
    cardBorder: 'FFE2E8F0',    // Slate-200
    insightBg: 'FFF0FDF4',     // Emerald-50 (Insight box)
    insightBorder: 'FFBBF7D0', // Emerald-200
    insightText: 'FF166534',   // Emerald-800

    // Borders & Structure
    border: 'FFE2E8F0',        // Slate-200
    borderStrong: 'FF94A3B8',  // Slate-400
    altRow: 'FFF8FAFC',        // Slate-50 — subtle alternate stripe

    // Semantic — Desaturated for High Print Contrast
    positive: 'FF059669',      // Emerald-600
    positiveBg: 'FFDCFCE7',    // Emerald-100
    caution: 'FFD97706',       // Amber-600
    cautionBg: 'FFFEF3C7',     // Amber-100
    critical: 'FFDC2626',      // Red-600
    criticalBg: 'FFFEE2E2',    // Red-100
    neutral: 'FF2563EB',       // Blue-600
    neutralBg: 'FFDBEAFE',     // Blue-100
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
const cardThinBorder: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: EXCEL_COLORS.cardBorder },
};

export const allThinBorders = {
    top: thinBorder,
    left: thinBorder,
    bottom: thinBorder,
    right: thinBorder,
};

export const allCardBorders = {
    top: cardThinBorder,
    left: cardThinBorder,
    bottom: cardThinBorder,
    right: cardThinBorder,
};

// ─── STYLE PRESETS ───────────────────────────────────────────
export const EXCEL_STYLES = {
    /** Table header — corporate dark slate, white text, center-aligned */
    header: {
        font: { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.headerText } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: EXCEL_COLORS.headerBg } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true },
        border: {
            top: mediumBorder,
            left: thinBorder,
            bottom: mediumBorder,
            right: thinBorder,
        },
    } as Partial<ExcelJS.Style>,

    /** Standard data cell — clean borders & padding */
    cell: {
        font: { name: 'Calibri', size: 10, color: { argb: EXCEL_COLORS.text } },
        alignment: { vertical: 'middle' as const },
        border: allThinBorders,
    } as Partial<ExcelJS.Style>,

    /** Numeric aligned cell */
    cellNumber: {
        font: { name: 'Calibri', size: 10, color: { argb: EXCEL_COLORS.text } },
        alignment: { horizontal: 'right' as const, vertical: 'middle' as const },
        border: allThinBorders,
    } as Partial<ExcelJS.Style>,

    /** Center aligned cell */
    cellCenter: {
        font: { name: 'Calibri', size: 10, color: { argb: EXCEL_COLORS.text } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
        border: allThinBorders,
    } as Partial<ExcelJS.Style>,

    /** Executive Report Main Title */
    title: {
        font: { name: 'Calibri', size: 16, bold: true, color: { argb: EXCEL_COLORS.titleText } },
        alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
    } as Partial<ExcelJS.Style>,

    /** Corporate Organization Subheader */
    orgHeader: {
        font: { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.primary } },
        alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
    } as Partial<ExcelJS.Style>,

    /** Subtitle & Metadata text */
    subtitle: {
        font: { name: 'Calibri', size: 9, color: { argb: EXCEL_COLORS.subtitleText } },
        alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
    } as Partial<ExcelJS.Style>,

    /** Section banner header */
    sectionHeader: {
        font: { name: 'Calibri', size: 11, bold: true, color: { argb: EXCEL_COLORS.titleText } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF1F5F9' } }, // Slate-100
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

    /** Executive KPI Card Label (Top) */
    kpiLabel: {
        font: { name: 'Calibri', size: 8.5, bold: true, color: { argb: EXCEL_COLORS.subtitleText } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: EXCEL_COLORS.cardBg } },
        border: allCardBorders,
    } as Partial<ExcelJS.Style>,

    /** Executive KPI Card Value (Large Center) */
    kpiValue: {
        font: { name: 'Calibri', size: 16, bold: true, color: { argb: EXCEL_COLORS.titleText } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: EXCEL_COLORS.cardBg } },
        border: allCardBorders,
    } as Partial<ExcelJS.Style>,

    /** Executive KPI Card Subtext (Bottom) */
    kpiSubtext: {
        font: { name: 'Calibri', size: 8, italic: true, color: { argb: EXCEL_COLORS.textMuted } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: EXCEL_COLORS.cardBg } },
        border: allCardBorders,
    } as Partial<ExcelJS.Style>,

    /** Executive Key Insight Item */
    insightItem: {
        font: { name: 'Calibri', size: 9.5, color: { argb: EXCEL_COLORS.text } },
        alignment: { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF8FAFC' } },
        border: allThinBorders,
    } as Partial<ExcelJS.Style>,
};

// ─── HELPER FUNCTIONS ────────────────────────────────────────

/**
 * Apply corporate header banner to a sheet
 */
export function drawCorporateExcelHeader(
    sheet: ExcelJS.Worksheet,
    title: string,
    periodText: string,
    scopeText: string = 'PT Santos Jaya Abadi — All Sites',
    lastColChar: string = 'F'
): number {
    // Row 1: Org name
    sheet.mergeCells(`A1:${lastColChar}1`);
    const orgCell = sheet.getCell('A1');
    orgCell.value = 'PT SANTOS JAYA ABADI — iDesk IT Helpdesk & Service Management';
    Object.assign(orgCell, { style: EXCEL_STYLES.orgHeader });
    sheet.getRow(1).height = 18;

    // Row 2: Title
    sheet.mergeCells(`A2:${lastColChar}2`);
    const titleCell = sheet.getCell('A2');
    titleCell.value = title;
    Object.assign(titleCell, { style: EXCEL_STYLES.title });
    sheet.getRow(2).height = 28;

    // Row 3: Metadata info
    sheet.mergeCells(`A3:${lastColChar}3`);
    const metaCell = sheet.getCell('A3');
    const generatedAt = new Date().toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Periode: ${periodText}   |   Scope: ${scopeText}   |   Generated: ${generatedAt}`;
    Object.assign(metaCell, { style: EXCEL_STYLES.subtitle });
    sheet.getRow(3).height = 18;

    // Empty spacing
    sheet.getRow(4).height = 10;
    return 5;
}

/**
 * Draw Executive KPI Cards in a row
 */
export function drawExecutiveKpiCards(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    cards: Array<{ label: string; value: string | number; subtext?: string }>,
    colPairs: Array<[string, string]> // e.g. [['A','B'], ['C','D'], ['E','F']]
): number {
    const row1 = startRow;
    const row2 = startRow + 1;
    const row3 = startRow + 2;

    sheet.getRow(row1).height = 16;
    sheet.getRow(row2).height = 26;
    sheet.getRow(row3).height = 16;

    cards.forEach((card, idx) => {
        if (idx >= colPairs.length) return;
        const [c1, c2] = colPairs[idx];

        sheet.mergeCells(`${c1}${row1}:${c2}${row1}`);
        const lCell = sheet.getCell(`${c1}${row1}`);
        lCell.value = card.label.toUpperCase();
        Object.assign(lCell, { style: EXCEL_STYLES.kpiLabel });

        sheet.mergeCells(`${c1}${row2}:${c2}${row2}`);
        const vCell = sheet.getCell(`${c1}${row2}`);
        vCell.value = card.value;
        Object.assign(vCell, { style: EXCEL_STYLES.kpiValue });

        sheet.mergeCells(`${c1}${row3}:${c2}${row3}`);
        const sCell = sheet.getCell(`${c1}${row3}`);
        sCell.value = card.subtext || '';
        Object.assign(sCell, { style: EXCEL_STYLES.kpiSubtext });
    });

    sheet.getRow(row3 + 1).height = 10; // spacing
    return row3 + 2;
}

/**
 * Draw Executive Insights Section
 */
export function drawExecutiveInsightsSection(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    insights: string[],
    lastColChar: string = 'F'
): number {
    let currRow = startRow;

    sheet.mergeCells(`A${currRow}:${lastColChar}${currRow}`);
    const secCell = sheet.getCell(`A${currRow}`);
    secCell.value = 'EXECUTIVE SUMMARY & KEY TAKEAWAYS';
    Object.assign(secCell, { style: EXCEL_STYLES.sectionHeader });
    sheet.getRow(currRow).height = 22;
    currRow++;

    insights.forEach((insight, idx) => {
        sheet.mergeCells(`A${currRow}:${lastColChar}${currRow}`);
        const cell = sheet.getCell(`A${currRow}`);
        cell.value = `•  ${insight}`;
        Object.assign(cell, { style: EXCEL_STYLES.insightItem });
        sheet.getRow(currRow).height = 24;
        currRow++;
    });

    sheet.getRow(currRow).height = 12; // spacing
    return currRow + 1;
}

/**
 * Apply header style to a specific row (accepts Worksheet + rowNumber or Row object directly)
 */
export function applyHeaderStyle(target: ExcelJS.Worksheet | ExcelJS.Row, rowNumber: number = 1): void {
    const row = 'getRow' in target ? (target as ExcelJS.Worksheet).getRow(rowNumber) : (target as ExcelJS.Row);
    row.height = 24;
    row.eachCell(cell => Object.assign(cell, { style: EXCEL_STYLES.header }));
}

/**
 * Apply standard row styling with alternating background
 */
export function applyRowStyle(row: ExcelJS.Row, idx: number): void {
    row.height = 20;
    row.eachCell(cell => {
        if (!cell.style.font) {
            Object.assign(cell, { style: EXCEL_STYLES.cell });
        }
        if (idx % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
        }
    });
}

/**
 * Configure Freeze Panes on a worksheet
 */
export function setupFreezePanes(sheet: ExcelJS.Worksheet, headerRow: number = 1): void {
    sheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: headerRow, topLeftCell: `A${headerRow + 1}` }
    ];
}

/**
 * Configure Auto-Filter on a worksheet for a given range
 */
export function applyAutoFilter(sheet: ExcelJS.Worksheet, fromCol: string, fromRow: number, toCol: string, toRow: number): void {
    sheet.autoFilter = `${fromCol}${fromRow}:${toCol}${toRow}`;
}

/**
 * Auto-fit column widths with min & max bounds
 */
export function autoFitColumns(sheet: ExcelJS.Worksheet, minWidth: number = 12, maxWidth: number = 45): void {
    sheet.columns.forEach(column => {
        let maxLen = 0;
        if (column.header) {
            maxLen = Math.max(maxLen, String(column.header).length);
        }
        column.eachCell?.({ includeEmpty: false }, cell => {
            const cellValue = cell.value ? cell.value.toString() : '';
            // Avoid extreme length on merged title rows
            if (!cell.isMerged || cell.address.includes('A1') || cell.address.includes('A2')) {
                if (cellValue.length < 50) {
                    maxLen = Math.max(maxLen, cellValue.length);
                }
            }
        });
        column.width = Math.min(Math.max(maxLen + 4, minWidth), maxWidth);
    });
}

/**
 * Get cell font color based on status value
 */
export function getStatusColor(status: string): { argb: string } {
    switch (status?.toUpperCase()) {
        case 'RESOLVED':
        case 'CLOSED':
            return { argb: EXCEL_COLORS.positive };
        case 'IN_PROGRESS':
            return { argb: EXCEL_COLORS.neutral };
        case 'WAITING_VENDOR':
        case 'TODO':
        case 'PENDING':
            return { argb: EXCEL_COLORS.caution };
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
    switch (priority?.toUpperCase()) {
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
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MONTH_NAMES_EN = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Create a styled workbook with default metadata
 */
export function createStyledWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT Santos Jaya Abadi — iDesk System';
    workbook.lastModifiedBy = 'iDesk Service Management';
    workbook.created = new Date();
    workbook.modified = new Date();
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
