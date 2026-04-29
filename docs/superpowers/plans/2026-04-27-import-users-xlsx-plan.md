# Import Users XLSX Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the "Import Users" feature from CSV to an Excel (XLSX) template with Data Validation (dropdowns) for a premium user experience.

**Architecture:** The backend will generate an XLSX template using `exceljs`, providing dropdowns for roles and sites. The frontend will parse the XLSX file locally using `xlsx` (SheetJS) for live validation before sending it to the backend. The backend will parse the uploaded XLSX file using `exceljs` to insert/upsert users.

**Tech Stack:** `exceljs` (Backend), `xlsx` (Frontend), React, NestJS.

---

### Task 1: Generate XLSX Template in Backend

**Files:**
- Modify: `apps/backend/src/modules/users/users.service.ts`
- Modify: `apps/backend/src/modules/users/users.controller.ts`

- [ ] **Step 1: Modify `generateImportTemplate` in `users.service.ts`**
Replace `generateImportTemplate` to use `exceljs` and return a Promise resolving to a Buffer. Add dropdown validation for roles and sites.

```typescript
    async generateImportTemplate(): Promise<{ data: Buffer; filename: string }> {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        
        // Data Sheet
        const dataSheet = workbook.addWorksheet('Users');
        dataSheet.columns = [
            { header: 'email', key: 'email', width: 25 },
            { header: 'fullName', key: 'fullName', width: 25 },
            { header: 'role', key: 'role', width: 15 },
            { header: 'siteCode', key: 'siteCode', width: 15 },
            { header: 'departmentCode', key: 'departmentCode', width: 15 },
            { header: 'presetName', key: 'presetName', width: 15 },
            { header: 'employeeId', key: 'employeeId', width: 15 },
            { header: 'jobTitle', key: 'jobTitle', width: 20 },
            { header: 'phoneNumber', key: 'phoneNumber', width: 20 },
            { header: 'isActive', key: 'isActive', width: 15 }
        ];

        // Format header
        dataSheet.getRow(1).font = { bold: true };
        dataSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        // Instructions Sheet
        const instSheet = workbook.addWorksheet('Instructions');
        instSheet.getColumn('A').width = 20;
        instSheet.getColumn('B').width = 40;
        
        instSheet.addRow(['Field', 'Valid Values']);
        instSheet.getRow(1).font = { bold: true };
        instSheet.addRow(['Role', 'USER, AGENT, MANAGER, ADMIN']);
        instSheet.addRow(['Site Code', 'SPJ, SMG, KRW, JTB']);
        instSheet.addRow(['Is Active', 'true, false']);
        
        // Add Data Validation (Dropdowns) for the first 100 rows
        for (let i = 2; i <= 100; i++) {
            dataSheet.getCell(`C${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"USER,AGENT,MANAGER,ADMIN"']
            };
            dataSheet.getCell(`D${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"SPJ,SMG,KRW,JTB"']
            };
            dataSheet.getCell(`J${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"true,false"']
            };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return {
            data: buffer,
            filename: 'import-users-template.xlsx',
        };
    }
```

- [ ] **Step 2: Update `users.controller.ts` endpoint**
Modify `@Get('import-template')` to handle the async buffer and change response headers. Make sure to add `async` to the method signature.

```typescript
    @Get('import-template')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Download import template XLSX' })
    @ApiResponse({ status: 200, description: 'Template XLSX file.' })
    async getImportTemplate(@Res() res: Response) {
        const template = await this.usersService.generateImportTemplate();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${template.filename}`);
        return res.send(template.data);
    }
```

- [ ] **Step 3: Check types and commit**

```bash
cd apps/backend
npm run build
git add src/modules/users/users.service.ts src/modules/users/users.controller.ts
git commit -m "feat(backend): generate xlsx template with dropdowns for users import"
```

---

### Task 2: Process XLSX Upload in Backend

**Files:**
- Modify: `apps/backend/src/modules/users/users.service.ts`
- Modify: `apps/backend/src/shared/core/config/upload.config.ts`

- [ ] **Step 1: Allow `.xlsx` in upload config**
Update `MULTER_OPTIONS.csv` in `upload.config.ts` to allow `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Since the variable is named `.csv`, we can rename it to `.import` or just update its allowed mimetypes. Let's rename it to `.import` if possible, but to minimize changes, just add the mimetype and change the extension regex.

```typescript
// in upload.config.ts
export const MULTER_OPTIONS = {
    // ...
    import: { // or modify the existing one used for import
        dest: './uploads/temp',
        fileFilter: (req: any, file: any, cb: any) => {
            if (
                file.mimetype === 'text/csv' ||
                file.mimetype === 'application/vnd.ms-excel' ||
                file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.originalname.match(/\.(csv|xlsx)$/)
            ) {
                cb(null, true);
            } else {
                cb(new BadRequestException('Only CSV and XLSX files are allowed!'), false);
            }
        },
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB
        },
    },
};
```
*Note: Make sure to check `users.controller.ts` `@UseInterceptors(FileInterceptor('file', MULTER_OPTIONS.import))` if renaming.*

- [ ] **Step 2: Update `importUsers` to parse XLSX**
Modify `importUsers` in `users.service.ts` to use `exceljs` to parse the buffer.

```typescript
    async importUsers(file: Express.Multer.File, upsert = false): Promise<any> {
        const results: any[] = [];
        const errors: string[] = [];
        let successCount = 0;
        let updatedCount = 0;
        let failedCount = 0;

        // Pre-load sites and departments
        const sites = await this.siteRepo.find();
        const siteMap = new Map<string, Site>();
        sites.forEach(s => siteMap.set(s.code.toUpperCase(), s));

        const departments = await this.departmentRepo.find();
        const deptMap = new Map<string, Department>();
        departments.forEach(d => deptMap.set(d.code?.toUpperCase() || d.name.toUpperCase(), d));

        // Parse XLSX
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        
        try {
            await workbook.xlsx.load(file.buffer);
            const worksheet = workbook.getWorksheet(1); // 'Users' sheet or first sheet
            
            if (!worksheet) {
                throw new BadRequestException('No worksheet found in the Excel file');
            }

            // Map headers from row 1
            const headers: string[] = [];
            worksheet.getRow(1).eachCell((cell, colNumber) => {
                headers[colNumber] = cell.value?.toString().trim() || '';
            });

            // Iterate rows
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header
                
                const rowData: any = {};
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber];
                    if (header) {
                        rowData[header] = cell.value?.toString().trim() || '';
                    }
                });
                
                // Only push if email exists (skip completely empty rows)
                if (rowData.email) {
                    results.push(rowData);
                }
            });

        } catch (error) {
            throw new BadRequestException(`Failed to parse file: ${error.message}`);
        }

        // Keep the rest of the existing validation and DB logic unchanged
        // (Iterate over `results`, check rows, create/update users, etc.)
        for (const [index, row] of results.entries()) {
             // ... existing processing loop ...
```

- [ ] **Step 3: Run backend build and commit**

```bash
cd apps/backend
npm run build
git add src/modules/users/users.service.ts src/shared/core/config/upload.config.ts src/modules/users/users.controller.ts
git commit -m "feat(backend): process xlsx file uploads for user import"
```

---

### Task 3: Frontend Excel Parsing

**Files:**
- Modify: `apps/frontend/package.json`
- Modify: `apps/frontend/src/features/admin/components/ImportUsersDialog.tsx`

- [ ] **Step 1: Install `xlsx` package in frontend**

```bash
cd apps/frontend
npm install xlsx
```

- [ ] **Step 2: Update `ImportUsersDialog.tsx` logic**
Import `read` and `utils` from `xlsx`. Change `handleFileSelect` to read file as ArrayBuffer and parse XLSX instead of using `PapaParse`.

```tsx
import { read, utils } from 'xlsx';

// ... Inside handleFileSelect ...
        // Validate file type
        if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
            setParseError('Invalid file type. Please upload a CSV or XLSX file.');
            return;
        }

        // ... Size check ...

        setSelectedFile(file);
        setIsParsing(true);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = utils.sheet_to_json<ParsedRow>(worksheet, { defval: '' });
                
                if (json.length === 0) {
                    setParseError('File is empty or has no valid data rows.');
                    setIsParsing(false);
                    return;
                }

                setTotalRows(json.length);
                const validatedRows = json.map((row, idx) => validateRow(row, idx));
                setPreviewData(validatedRows);
                setStep('preview');
                setIsParsing(false);
            } catch (error: any) {
                setParseError(`Failed to parse file: ${error.message}`);
                setIsParsing(false);
            }
        };
        reader.onerror = () => {
            setParseError('Failed to read file');
            setIsParsing(false);
        };
        reader.readAsArrayBuffer(file);
```

- [ ] **Step 3: Update `ImportUsersDialog.tsx` UI Copy**
Change `accept=".csv"` to `accept=".csv,.xlsx"`. Update text references from "Download CSV" to "Download Template" and "Upload CSV" to "Upload Excel/CSV".
Fix `downloadTemplate` function's filename logic to use `.xlsx`.

```tsx
// Inside downloadTemplate
            link.setAttribute('download', 'import-users-template.xlsx');
```

- [ ] **Step 4: Build and commit**

```bash
cd apps/frontend
npm run build
git add package.json package-lock.json src/features/admin/components/ImportUsersDialog.tsx
git commit -m "feat(frontend): support parsing and uploading xlsx files for user import"
```
