/**
 * CSI respondent departments, from "Data Hirarki Approver.xlsx" (sheet 4. ALL DATA_SJA, 2026-11).
 * Cleaned: whitespace collapsed, "INFRASTURCTURE" typo fixed, job titles that sat in the Department column
 * (GENERAL MANAGER, PLANT MANAGER, POM n) left out. Stored as "<DIVISION> / <DEPARTMENT>" so the same department
 * name under different divisions (QUALITY CONTROL, MAINTENANCE, ...) stays distinct.
 */
export const CSI_DEPARTMENT_SEPARATOR = ' / ';

export const CSI_DEPARTMENTS_2026: ReadonlyArray<{ division: string; departments: readonly string[] }> = [
    { division: 'DAFT', departments: ['DAFT', 'FINANCE, TAX, ACCOUNTING', 'FINANCE, TAX, ACCOUNTING - ACCOUNTING', 'FINANCE, TAX, ACCOUNTING - DAFT AREA', 'FINANCE, TAX, ACCOUNTING - FINANCE', 'FINANCE, TAX, ACCOUNTING - TAX', 'FINANCIAL MANAGEMENT', 'FINANCIAL MANAGEMENT - COSTING', 'FINANCIAL MANAGEMENT - OPERATION & FINANCE'] },
    { division: 'HUMAN CAPITAL', departments: ['HC COMPENSATION & BENEFIT', 'HC DEVELOPMENT', 'HC SERVICES', 'HCBP AREA JAKARTA', 'HCBP AREA KARAWANG', 'HCBP AREA SEMARANG', 'HCBP AREA SUKODONO', 'HSE'] },
    { division: 'ICT', departments: ['INFORMATION SYSTEM DEVELOPMENT', 'SECURITY & NETWORK INFRASTRUCTURE'] },
    { division: 'MARKETING', departments: ['BELOW THE LINE', 'BRAND', 'BRAND (DIGITAL)', 'DESIGN', 'E-COMMERCE', 'KAG - OBD', 'MANAGEMENT TRAINEE', 'MARKETING', 'MARKETING INFORMATION SYSTEM', 'MODERN TRADE', 'NEW PRODUCT DEVELOPMENT', 'OUT OF HOME', 'PREMIUM PRODUCT LINE', 'PRODUCT PORTFOLIO MANAGEMENT', 'RESEARCH', 'SECRETARY'] },
    { division: 'OPERATION', departments: ['ENGINEERING', 'LOGISTIC', 'MANAGEMENT TRAINEE', 'PPIC', 'QA', 'SECRETARY', 'WAREHOUSE'] },
    { division: 'OPERATION SJA 1', departments: ['MAINTENANCE', 'OPERATIONAL EXCELLENCE', 'PRODUCTION 1', 'PRODUCTION 2', 'QUALITY CONTROL', 'SECRETARY', 'WAREHOUSE'] },
    { division: 'OPERATION SJA 2', departments: ['MAINTENANCE', 'OPERATIONAL EXCELLENCE', 'PRODUCTION', 'QUALITY CONTROL', 'SECRETARY', 'WAREHOUSE'] },
    { division: 'OPERATION SJA 3', departments: ['MAINTENANCE', 'OPERATIONAL EXCELLENCE', 'PRODUCTION', 'QUALITY CONTROL', 'SECRETARY', 'SUPPLY CHAIN', 'UTILITY MAINTENANCE'] },
    { division: 'OPERATION SJA SEMARANG', departments: ['MAINTENANCE & UTILITY', 'WAREHOUSE'] },
    { division: 'OPERATION SJA SEMARANG POWDER', departments: ['MAINTENANCE - 3 IN 1', 'MAINTENANCE - R&G', 'OPERATIONAL EXCELLENCE', 'PRODUCTION - 3 IN 1', 'PRODUCTION - R&G', 'QUALITY CONTROL', 'QUALITY CONTROL - 3 IN 1', 'QUALITY CONTROL - R&G', 'SECRETARY'] },
    { division: 'OPERATION SJA SEMARANG RTD', departments: ['MAINTENANCE', 'OPERATIONAL EXCELLENCE', 'PRODUCTION', 'QUALITY CONTROL', 'SECRETARY'] },
    { division: 'PROCUREMENT', departments: ['COMMODITY PROCUREMENT', 'INDIRECT PROCUREMENT', 'RAW MATERIAL PROCUREMENT'] },
    { division: 'R & D', departments: ['R & D'] },
    { division: 'S&OE', departments: ['OE', 'S&PM'] },
];

/** Flat names in display order. */
export const CSI_DEPARTMENT_NAMES_2026: readonly string[] =
    CSI_DEPARTMENTS_2026.flatMap(({ division, departments }) => departments.map((department) => `${division}${CSI_DEPARTMENT_SEPARATOR}${department}`));
