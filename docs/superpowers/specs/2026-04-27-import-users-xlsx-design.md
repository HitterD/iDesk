# Import Users via XLSX Template Design

## Architecture Overview
The current "Import Users" feature relies on CSV templates. This causes UX issues when opened in Excel because comment rows (`#`) break tabular formatting. To provide a premium user experience, we are migrating the import template and processing flow from CSV to XLSX. This enables native Excel features like Data Validation (dropdowns) to prevent typos.

## Backend Changes

### 1. Endpoint `/users/import-template`
- Change response type from CSV to XLSX.
- Use `exceljs` to generate a two-sheet workbook:
  - **Sheet 1 ("Users")**: Data entry sheet. Only contains a header row.
  - **Sheet 2 ("Instructions")**: Contains guidelines, role definitions, and site definitions.
- Implement Data Validation on the "Users" sheet:
  - The `Role` column (C) will have a dropdown of `USER, AGENT, MANAGER, ADMIN`.
  - The `SiteCode` column (D) will have a dropdown of `SPJ, SMG, KRW, JTB`.

### 2. Endpoint `/users/import`
- Adjust file upload validation to accept `.xlsx` MIME types (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
- Update parsing logic in `users.service.ts` to read the uploaded `.xlsx` file using `exceljs` instead of basic CSV splitting.
- Only process rows from the "Users" sheet, skipping the header.

## Frontend Changes

### 1. Dependencies
- Install `xlsx` (SheetJS) to enable fast, client-side preview and validation without a roundtrip to the server.

### 2. `ImportUsersDialog.tsx`
- Change `accept` attribute on file input from `.csv` to `.xlsx`.
- Replace `PapaParse` logic with `xlsx` logic:
  - Read file as ArrayBuffer.
  - Read workbook and extract the first sheet ("Users").
  - Convert sheet to JSON (`XLSX.utils.sheet_to_json`).
  - Map JSON to `previewData` format.
- Update UI copy (e.g. "Download CSV" -> "Download Template", "Upload CSV" -> "Upload Excel File").
- Add maximum file size check specifically for XLSX (keep at 5MB).

## Data Flow
1. **Download**: User clicks "Download Template" -> Backend generates `exceljs` workbook -> Returns `.xlsx` blob -> Frontend triggers download.
2. **Edit**: User opens in Excel, selects Roles and Sites from dropdowns.
3. **Upload/Preview**: User uploads `.xlsx` -> Frontend parses via `xlsx` lib -> Validates and previews in table.
4. **Submit**: Frontend submits `.xlsx` via `FormData` to `/users/import` -> Backend uses `exceljs` to read workbook -> Validates -> Upserts/Creates users -> Returns summary.

## Testing & Verification
- Verify template downloads cleanly and opens in Excel without errors.
- Verify dropdowns (Data Validation) work in the "Users" sheet.
- Verify frontend preview parses the XLSX correctly and catches invalid rows.
- Verify backend successfully processes valid XLSX uploads and updates database.
