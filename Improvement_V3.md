# iDesk Strategic Improvement Plan V2.5

> **Role:** Principal Software Architect & Product Manager
> **Date:** November 28, 2025
> **Focus:** Zero-Cost Optimization & New "Renewal Reminder" Module

---

# Section 1: Feature Improvements (Free Tier Only)

These improvements focus on maximizing performance and UX using existing resources and open-source libraries, adhering to the **Zero-Cost Policy**.

## 1.1 Backend Optimizations (NestJS)

### A. Database Indexing & Query Optimization
*   **Current State:** Basic CRUD operations.
*   **Improvement:** Add database indexes to frequently queried columns to reduce lookup time from O(n) to O(log n).
    *   **Target Columns:** `ticket.status`, `ticket.priority`, `ticket.userId`, `ticket.assignedToId`.
    *   **Implementation:** Use TypeORM `@Index()` decorator.
    *   **Cost:** $0 (Database feature).

### B. Response Compression
*   **Current State:** Standard JSON responses.
*   **Improvement:** Enable Gzip compression for HTTP responses. This significantly reduces payload size (up to 70%) for large ticket lists or reports.
    *   **Implementation:** Install `compression` middleware (`npm i compression`) and register in `main.ts`.
    *   **Cost:** $0 (Open Source middleware).

### C. In-Memory Caching (Short-Lived)
*   **Current State:** Real-time updates via WebSockets, but REST endpoints might hit DB repeatedly.
*   **Improvement:** Implement `CacheInterceptor` for high-traffic read endpoints like `GET /dashboard/stats` with a short TTL (e.g., 10-30 seconds).
    *   **Implementation:** Use `@nestjs/cache-manager`.
    *   **Cost:** $0 (Uses server RAM).

## 1.2 Frontend Optimizations (React/Vite)

### A. Route-Based Code Splitting
*   **Current State:** Single bundle or partial splitting.
*   **Improvement:** Ensure Admin, Agent, and User portals are lazy-loaded. Users shouldn't download Admin dashboard code if they can't access it.
    *   **Implementation:** Use `React.lazy()` and `Suspense` for top-level routes.
    *   **Cost:** $0 (React feature).

### B. List Virtualization
*   **Current State:** Pagination is good, but large pages can still lag.
*   **Improvement:** Implement "Virtual Scrolling" for the Ticket List if rows > 50. Only render items currently in the viewport.
    *   **Implementation:** Use `react-window` (lightweight) or `@tanstack/react-virtual`.
    *   **Cost:** $0 (Open Source library).

---

# Section 2: New Module - "Admin Renewal Reminder"

> ## ✅ IMPLEMENTATION STATUS: COMPLETED (Nov 28, 2025)
> 
> ### Backend Implementation ✅
> | Component | File | Status |
> |-----------|------|--------|
> | Entity | `modules/renewal/entities/renewal-contract.entity.ts` | ✅ Done |
> | DTO (Create) | `modules/renewal/dto/create-contract.dto.ts` | ✅ Done |
> | DTO (Update) | `modules/renewal/dto/update-contract.dto.ts` | ✅ Done |
> | Interface | `modules/renewal/interfaces/extraction-strategy.interface.ts` | ✅ Done |
> | PDF Extraction | `modules/renewal/services/pdf-extraction.service.ts` | ✅ Done |
> | Scheduler | `modules/renewal/services/renewal-scheduler.service.ts` | ✅ Done |
> | Service | `modules/renewal/renewal.service.ts` | ✅ Done |
> | Controller | `modules/renewal/renewal.controller.ts` | ✅ Done |
> | Module | `modules/renewal/renewal.module.ts` | ✅ Done |
> | App Module | `app.module.ts` (RenewalModule + Entity registered) | ✅ Done |
> | Dependency | `pdf-parse` installed | ✅ Done |
> 
> ### Frontend Implementation ✅
> | Component | File | Status |
> |-----------|------|--------|
> | Types | `features/renewal/types/renewal.types.ts` | ✅ Done |
> | API Hooks | `features/renewal/hooks/useRenewalApi.ts` | ✅ Done |
> | Stats Cards | `features/renewal/components/ContractStats.tsx` | ✅ Done |
> | Data Table | `features/renewal/components/ContractTable.tsx` | ✅ Done |
> | Upload Modal | `features/renewal/components/ContractUploadModal.tsx` | ✅ Done |
> | Edit Modal | `features/renewal/components/ContractEditModal.tsx` | ✅ Done |
> | Manual Modal | `features/renewal/components/ManualContractModal.tsx` | ✅ Done |
> | Dashboard | `features/renewal/pages/RenewalDashboardPage.tsx` | ✅ Done |
> | Route | `App.tsx` (path="/renewal", Admin only) | ✅ Done |
> | Sidebar | `BentoSidebar.tsx` (CalendarClock icon + menu) | ✅ Done |
> 
> ### Features Implemented ✅
> - [x] PDF Upload with drag & drop
> - [x] Auto-extraction (Adobe, Allied, Generic patterns)
> - [x] Manual override form (after PDF upload)
> - [x] **Manual Contract Entry (without PDF)** ← NEW
> - [x] Dashboard stats cards
> - [x] Sortable/filterable contract table
> - [x] Daily scheduler (9 AM WIB) for D-30, D-7, D-1 reminders
> - [x] In-app + Email notifications to Admin users
> - [x] Admin-only access control
> 
> ### Pending / Future Enhancements 📋
> - [ ] Unit tests for PDF extraction strategies
> - [ ] E2E tests for upload flow
> - [ ] Email template customization for renewal reminders
> - [ ] Export contracts to Excel/CSV
> - [ ] Contract value tracking and analytics

---

## 2.1 Module Architecture & UI

### Positioning
*   **Access:** Strictly **Admin Only**.
*   **Location:** New Sidebar Menu Item: **"Renewal Reminders"** (Icon: `CalendarClock`).
*   **Isolation:** Built as a standalone `RenewalModule` in NestJS to keep the core Ticketing logic clean.

### User Workflow
1.  **Dashboard View:** A dedicated dashboard showing a summary of contracts:
    *   **Cards:** "Expiring in 30 Days", "Expired", "Active Contracts".
    *   **Table:** List of contracts with sortable columns (Vendor, PO No, End Date).
2.  **Upload Process:**
    *   Admin clicks **"Upload Contract"**.
    *   Drag & drop PDF file (BAST/PO).
    *   **System Action:** Backend parses PDF -> Extracts Metadata -> Returns JSON.
    *   **Review Modal:** Admin sees the extracted data in a form.
        *   *Crucial Step:* Admin verifies/corrects the data (e.g., fixes a typo in the date) before saving.
    *   **Save:** Record is stored in the database.
3.  **Automated Reminders:**
    *   System runs a daily cron job.
    *   Sends email notifications to Admins at **D-30**, **D-7**, and **D-1** before `end_date`.

## 2.2 Intelligent PDF Extraction Logic (The "Dictionary")

We will use `pdf-parse` (Node.js) to extract raw text, then apply Regex strategies to parse specific formats.

### Strategy 1: The "Adobe" Pattern
*   **Characteristics:**
    *   Explicit "Kontrak Purchase Order (PO) No." label.
    *   Date range in a single line: "Periode: [Start] - [End]".
*   **Extraction Rules:**
    1.  **PO Number:** Look for `Kontrak Purchase Order \(PO\) No\.` followed by alphanumeric characters.
    2.  **Date Range:** Look for `Periode\s*:\s*(.*?)\s*-\s*(.*)`.
    3.  **Parsing:** Split the captured groups into `startDate` and `endDate`.

### Strategy 2: The "Allied" Pattern
*   **Characteristics:**
    *   "NO. PO" label.
    *   Dates on separate lines or distinct labels: "Start date: ..." and "End Date: ...".
*   **Extraction Rules:**
    1.  **PO Number:** Look for `NO\.\s*PO\s*[:.]?\s*([A-Z0-9-/]+)`.
    2.  **Start Date:** Look for `Start date\s*[:.]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})`.
    3.  **End Date:** Look for `End Date\s*[:.]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})`.

### Date Normalization (Indonesian Support)
*   The system must map Indonesian months to English for standard `Date` parsing:
    *   `Januari` -> `January`, `Agustus` -> `August`, `Oktober` -> `October`, `Desember` -> `December`, etc.

## 2.3 Database & Manual Override (Flexible Schema)

### Database Schema (PostgreSQL)

We will use a flexible schema that allows nulls for extracted fields, enforcing only the ID and File Path initially.

```typescript
// Entity: RenewalContract
{
  id: string; // UUID, Primary Key
  
  // Metadata (Extracted or Manually Entered)
  poNumber: string | null;      // "PO-12345"
  vendorName: string | null;    // "PT. Adobe Systems"
  description: string | null;   // "Adobe Creative Cloud License"
  
  // Critical Dates (Used for Reminders)
  startDate: Date | null;
  endDate: Date | null;         // Indexed for Cron Job performance
  
  // File Storage
  originalFileName: string;     // "BAST_Adobe_2025.pdf"
  filePath: string;             // "/uploads/contracts/uuid.pdf"
  
  // Status
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED'; // Computed or stored
  
  // Audit
  uploadedBy: string;           // User ID
  createdAt: Date;
  updatedAt: Date;
}
```

### Manual Override UI
*   The "Add/Edit Contract" form will be pre-filled with extracted data.
*   **All fields are editable.** If the PDF parser fails completely, the Admin can simply type in the dates and PO number manually.
*   **Validation:** `endDate` is required to enable reminders. If missing, save as "Draft" (no reminders sent).

## 2.4 Implementation Roadmap (HIGH-LEVEL)

1.  **Backend Setup:**
    *   Generate `RenewalModule`, `RenewalController`, `RenewalService`.
    *   Create `RenewalContract` entity.
    *   Install `pdf-parse` and `@nestjs/schedule`.
2.  **PDF Parsing Service:**
    *   Implement `PdfExtractionService` with the defined Regex strategies.
    *   Unit test with sample BAST texts.
3.  **Frontend Implementation:**
    *   Create `RenewalDashboardPage`.
    *   Implement File Upload with "Parsing..." loading state.
    *   Create `ContractForm` for review/edit.
4.  **Scheduler:**
    *   Implement Cron Job (e.g., `@Cron('0 9 * * *')` - 9 AM daily).
    *   Query DB for contracts matching `endDate` = Today + 30/7/1.
    *   Trigger `NotificationService` (Email/In-App).

---

# Section 2: DETAILED IMPLEMENTATION PLAN

> **CRITICAL PRINCIPLE:** Module ini harus **100% ISOLATED** dari core ticketing system.
> - Tidak boleh modify entity existing (Ticket, User, Notification)
> - Tidak boleh modify service existing
> - Hanya boleh **IMPORT** dan **USE** service existing (read-only dependency)

---

## PHASE 1: Backend Infrastructure (Estimated: 4-6 hours)

### 1.1 Install Dependencies

**File:** `apps/backend/package.json`

```bash
cd apps/backend
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```

> **Note:** `@nestjs/schedule` sudah terinstall (lihat package.json line 40).

### 1.2 Create Module Structure

**New Files to Create:**
```
apps/backend/src/modules/renewal/
├── renewal.module.ts              # Module registration
├── renewal.controller.ts          # REST API endpoints
├── renewal.service.ts             # Business logic
├── entities/
│   └── renewal-contract.entity.ts # Database entity
├── dto/
│   ├── create-contract.dto.ts     # Input validation
│   ├── update-contract.dto.ts     # Partial update
│   └── extraction-result.dto.ts   # PDF parse response
├── services/
│   ├── pdf-extraction.service.ts  # PDF parsing logic
│   └── renewal-scheduler.service.ts # Cron jobs
└── interfaces/
    └── extraction-strategy.interface.ts
```

### 1.3 Entity Definition

**File:** `apps/backend/src/modules/renewal/entities/renewal-contract.entity.ts`

```typescript
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ContractStatus {
    DRAFT = 'DRAFT',           // endDate belum diisi
    ACTIVE = 'ACTIVE',         // endDate > today + 30 days
    EXPIRING_SOON = 'EXPIRING_SOON', // endDate <= today + 30 days
    EXPIRED = 'EXPIRED',       // endDate < today
}

@Entity('renewal_contracts')
export class RenewalContract {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // === METADATA (Extracted or Manual) ===
    @Column({ nullable: true })
    poNumber: string;

    @Column({ nullable: true })
    vendorName: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
    contractValue: number;

    // === CRITICAL DATES ===
    @Column({ type: 'date', nullable: true })
    startDate: Date;

    @Index('idx_renewal_end_date') // CRITICAL: Index for scheduler query
    @Column({ type: 'date', nullable: true })
    endDate: Date;

    // === FILE STORAGE ===
    @Column()
    originalFileName: string;

    @Column()
    filePath: string; // Relative path: /uploads/contracts/{uuid}.pdf

    @Column({ nullable: true })
    fileSize: number; // bytes

    // === STATUS ===
    @Column({
        type: 'enum',
        enum: ContractStatus,
        default: ContractStatus.DRAFT,
    })
    status: ContractStatus;

    // === REMINDER TRACKING ===
    @Column({ default: false })
    reminderD30Sent: boolean;

    @Column({ default: false })
    reminderD7Sent: boolean;

    @Column({ default: false })
    reminderD1Sent: boolean;

    // === AUDIT ===
    @Column()
    uploadedById: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'uploadedById' })
    uploadedBy: User;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // === EXTRACTION METADATA ===
    @Column({ nullable: true })
    extractionStrategy: string; // 'ADOBE' | 'ALLIED' | 'MANUAL'

    @Column({ type: 'float', nullable: true })
    extractionConfidence: number; // 0.0 - 1.0

    @Column({ type: 'jsonb', nullable: true })
    rawExtractedData: Record<string, any>; // Store raw extraction for debugging
}
```

### 1.4 Module Registration

**File:** `apps/backend/src/modules/renewal/renewal.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';

// Entity
import { RenewalContract } from './entities/renewal-contract.entity';

// Services
import { RenewalService } from './renewal.service';
import { PdfExtractionService } from './services/pdf-extraction.service';
import { RenewalSchedulerService } from './services/renewal-scheduler.service';

// Controller
import { RenewalController } from './renewal.controller';

// External Dependencies (READ-ONLY)
import { NotificationModule } from '../notifications/notification.module';
import { UsersModule } from '../users/users.module';

// Ensure upload directory exists
const contractsUploadPath = join(process.cwd(), 'uploads', 'contracts');
if (!existsSync(contractsUploadPath)) {
    mkdirSync(contractsUploadPath, { recursive: true });
}

@Module({
    imports: [
        TypeOrmModule.forFeature([RenewalContract]),
        MulterModule.register({
            storage: diskStorage({
                destination: contractsUploadPath,
                filename: (req, file, callback) => {
                    const uniqueId = randomUUID();
                    const ext = extname(file.originalname);
                    callback(null, `${uniqueId}${ext}`);
                },
            }),
            fileFilter: (req, file, callback) => {
                // Only allow PDF files
                if (file.mimetype === 'application/pdf') {
                    callback(null, true);
                } else {
                    callback(new Error('Only PDF files are allowed'), false);
                }
            },
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB max
            },
        }),
        // IMPORTANT: Import for READ-ONLY use, not modification
        NotificationModule,
        UsersModule,
    ],
    controllers: [RenewalController],
    providers: [
        RenewalService,
        PdfExtractionService,
        RenewalSchedulerService,
    ],
    exports: [RenewalService],
})
export class RenewalModule {}
```

### 1.5 Register in App Module

**File:** `apps/backend/src/app.module.ts`

**ADD Import:**
```typescript
import { RenewalModule } from './modules/renewal/renewal.module';
import { RenewalContract } from './modules/renewal/entities/renewal-contract.entity';
```

**ADD to entities array (line 64):**
```typescript
entities: [...existing, RenewalContract],
```

**ADD to imports array (after SearchModule, line 108):**
```typescript
RenewalModule,
```

> **ISOLATION CHECK:** Hanya menambahkan, tidak mengubah existing code.

---

## PHASE 2: PDF Extraction Service (Estimated: 3-4 hours)

### 2.1 Extraction Strategy Interface

**File:** `apps/backend/src/modules/renewal/interfaces/extraction-strategy.interface.ts`

```typescript
export interface ExtractionResult {
    poNumber: string | null;
    vendorName: string | null;
    startDate: Date | null;
    endDate: Date | null;
    contractValue: number | null;
    description: string | null;
    confidence: number; // 0.0 - 1.0
    strategy: string;   // Which pattern matched
    rawText?: string;   // For debugging
}

export interface IExtractionStrategy {
    name: string;
    canHandle(text: string): boolean;
    extract(text: string): ExtractionResult;
}
```

### 2.2 PDF Extraction Service

**File:** `apps/backend/src/modules/renewal/services/pdf-extraction.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as fs from 'fs';
import { ExtractionResult, IExtractionStrategy } from '../interfaces/extraction-strategy.interface';

@Injectable()
export class PdfExtractionService {
    private readonly logger = new Logger(PdfExtractionService.name);
    private strategies: IExtractionStrategy[] = [];

    constructor() {
        // Register extraction strategies in order of priority
        this.strategies = [
            new AdobePatternStrategy(),
            new AlliedPatternStrategy(),
            new GenericPatternStrategy(), // Fallback
        ];
    }

    async extractFromFile(filePath: string): Promise<ExtractionResult> {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            const text = pdfData.text;

            this.logger.debug(`Extracted ${text.length} characters from PDF`);

            // Try each strategy in order
            for (const strategy of this.strategies) {
                if (strategy.canHandle(text)) {
                    this.logger.log(`Using strategy: ${strategy.name}`);
                    const result = strategy.extract(text);
                    result.rawText = text.substring(0, 2000); // First 2000 chars for debugging
                    return result;
                }
            }

            // No strategy matched - return empty result
            return {
                poNumber: null,
                vendorName: null,
                startDate: null,
                endDate: null,
                contractValue: null,
                description: null,
                confidence: 0,
                strategy: 'NONE',
                rawText: text.substring(0, 2000),
            };
        } catch (error) {
            this.logger.error(`PDF extraction failed: ${error.message}`);
            throw error;
        }
    }
}

// === STRATEGY IMPLEMENTATIONS ===

class AdobePatternStrategy implements IExtractionStrategy {
    name = 'ADOBE';

    canHandle(text: string): boolean {
        return text.includes('Kontrak Purchase Order') || 
               text.includes('Adobe') ||
               /Periode\s*:/i.test(text);
    }

    extract(text: string): ExtractionResult {
        const result: ExtractionResult = {
            poNumber: null,
            vendorName: null,
            startDate: null,
            endDate: null,
            contractValue: null,
            description: null,
            confidence: 0,
            strategy: this.name,
        };

        // Extract PO Number
        const poMatch = text.match(/(?:Kontrak\s+)?Purchase\s+Order\s*\(?PO\)?\s*(?:No\.?|:)?\s*([A-Z0-9\-\/]+)/i);
        if (poMatch) {
            result.poNumber = poMatch[1].trim();
            result.confidence += 0.25;
        }

        // Extract Date Range: "Periode: 1 November 2024 - 31 Oktober 2025"
        const periodeMatch = text.match(/Periode\s*:\s*(\d{1,2}\s+\w+\s+\d{4})\s*[-–]\s*(\d{1,2}\s+\w+\s+\d{4})/i);
        if (periodeMatch) {
            result.startDate = this.parseIndonesianDate(periodeMatch[1]);
            result.endDate = this.parseIndonesianDate(periodeMatch[2]);
            result.confidence += 0.5;
        }

        // Extract Vendor Name
        const vendorMatch = text.match(/(?:PT\.|CV\.|Vendor:?)\s*([A-Za-z\s\.]+?)(?:\n|,|$)/i);
        if (vendorMatch) {
            result.vendorName = vendorMatch[1].trim();
            result.confidence += 0.25;
        }

        return result;
    }

    private parseIndonesianDate(dateStr: string): Date | null {
        const months: Record<string, string> = {
            'januari': 'January', 'februari': 'February', 'maret': 'March',
            'april': 'April', 'mei': 'May', 'juni': 'June',
            'juli': 'July', 'agustus': 'August', 'september': 'September',
            'oktober': 'October', 'november': 'November', 'desember': 'December',
        };

        let normalized = dateStr.toLowerCase();
        for (const [id, en] of Object.entries(months)) {
            normalized = normalized.replace(id, en);
        }

        const parsed = new Date(normalized);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
}

class AlliedPatternStrategy implements IExtractionStrategy {
    name = 'ALLIED';

    canHandle(text: string): boolean {
        return text.includes('NO. PO') || 
               text.includes('Allied') ||
               /Start\s+date/i.test(text);
    }

    extract(text: string): ExtractionResult {
        const result: ExtractionResult = {
            poNumber: null,
            vendorName: null,
            startDate: null,
            endDate: null,
            contractValue: null,
            description: null,
            confidence: 0,
            strategy: this.name,
        };

        // Extract PO Number: "NO. PO : P251580"
        const poMatch = text.match(/NO\.\s*PO\s*[:.]?\s*([A-Z0-9\-\/]+)/i);
        if (poMatch) {
            result.poNumber = poMatch[1].trim();
            result.confidence += 0.25;
        }

        // Extract Start Date
        const startMatch = text.match(/Start\s+date\s*[:.]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
        if (startMatch) {
            result.startDate = this.parseIndonesianDate(startMatch[1]);
            result.confidence += 0.25;
        }

        // Extract End Date
        const endMatch = text.match(/End\s+Date\s*[:.]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
        if (endMatch) {
            result.endDate = this.parseIndonesianDate(endMatch[1]);
            result.confidence += 0.25;
        }

        // Extract Vendor
        if (text.includes('Allied')) {
            result.vendorName = 'Allied';
            result.confidence += 0.25;
        }

        return result;
    }

    private parseIndonesianDate(dateStr: string): Date | null {
        const months: Record<string, string> = {
            'januari': 'January', 'februari': 'February', 'maret': 'March',
            'april': 'April', 'mei': 'May', 'juni': 'June',
            'juli': 'July', 'agustus': 'August', 'september': 'September',
            'oktober': 'October', 'november': 'November', 'desember': 'December',
        };

        let normalized = dateStr.toLowerCase();
        for (const [id, en] of Object.entries(months)) {
            normalized = normalized.replace(id, en);
        }

        const parsed = new Date(normalized);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
}

class GenericPatternStrategy implements IExtractionStrategy {
    name = 'GENERIC';

    canHandle(text: string): boolean {
        return true; // Always fallback
    }

    extract(text: string): ExtractionResult {
        const result: ExtractionResult = {
            poNumber: null,
            vendorName: null,
            startDate: null,
            endDate: null,
            contractValue: null,
            description: null,
            confidence: 0,
            strategy: this.name,
        };

        // Try generic PO patterns
        const poPatterns = [
            /PO\s*(?:No\.?|Number|#)?\s*[:.]?\s*([A-Z0-9\-\/]+)/i,
            /Purchase\s+Order\s*[:.]?\s*([A-Z0-9\-\/]+)/i,
        ];

        for (const pattern of poPatterns) {
            const match = text.match(pattern);
            if (match) {
                result.poNumber = match[1].trim();
                result.confidence += 0.15;
                break;
            }
        }

        // Try generic date patterns
        const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
        const dates = [...text.matchAll(datePattern)];
        if (dates.length >= 2) {
            result.startDate = new Date(`${dates[0][3]}-${dates[0][2]}-${dates[0][1]}`);
            result.endDate = new Date(`${dates[1][3]}-${dates[1][2]}-${dates[1][1]}`);
            result.confidence += 0.3;
        }

        return result;
    }
}
```

---

## PHASE 3: REST API Controller (Estimated: 3-4 hours)

### 3.1 DTOs

**File:** `apps/backend/src/modules/renewal/dto/create-contract.dto.ts`

```typescript
import { IsOptional, IsString, IsDateString, IsNumber, Min, Max } from 'class-validator';

export class CreateContractDto {
    @IsOptional()
    @IsString()
    poNumber?: string;

    @IsOptional()
    @IsString()
    vendorName?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    contractValue?: number;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}

export class UpdateContractDto extends CreateContractDto {}
```

### 3.2 Renewal Service

**File:** `apps/backend/src/modules/renewal/renewal.service.ts`

```typescript
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan, Between, IsNull, Not } from 'typeorm';
import { RenewalContract, ContractStatus } from './entities/renewal-contract.entity';
import { PdfExtractionService } from './services/pdf-extraction.service';
import { CreateContractDto, UpdateContractDto } from './dto/create-contract.dto';

@Injectable()
export class RenewalService {
    private readonly logger = new Logger(RenewalService.name);

    constructor(
        @InjectRepository(RenewalContract)
        private readonly contractRepo: Repository<RenewalContract>,
        private readonly pdfExtractionService: PdfExtractionService,
    ) {}

    // === UPLOAD & EXTRACT ===
    async uploadAndExtract(
        file: Express.Multer.File,
        uploadedById: string,
    ): Promise<{ contract: RenewalContract; extraction: any }> {
        // 1. Extract data from PDF
        const extraction = await this.pdfExtractionService.extractFromFile(file.path);

        // 2. Create contract record
        const contract = this.contractRepo.create({
            originalFileName: file.originalname,
            filePath: `/uploads/contracts/${file.filename}`,
            fileSize: file.size,
            uploadedById,
            poNumber: extraction.poNumber,
            vendorName: extraction.vendorName,
            startDate: extraction.startDate,
            endDate: extraction.endDate,
            description: extraction.description,
            contractValue: extraction.contractValue,
            extractionStrategy: extraction.strategy,
            extractionConfidence: extraction.confidence,
            rawExtractedData: extraction,
            status: extraction.endDate ? ContractStatus.ACTIVE : ContractStatus.DRAFT,
        });

        // 3. Calculate initial status
        if (contract.endDate) {
            contract.status = this.calculateStatus(contract.endDate);
        }

        const saved = await this.contractRepo.save(contract);
        
        this.logger.log(`Contract uploaded: ${saved.id} (${extraction.strategy}, confidence: ${extraction.confidence})`);

        return { contract: saved, extraction };
    }

    // === CRUD OPERATIONS ===
    async findAll(filters?: {
        status?: ContractStatus;
        search?: string;
    }): Promise<RenewalContract[]> {
        const query = this.contractRepo
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.uploadedBy', 'uploader')
            .orderBy('c.endDate', 'ASC');

        if (filters?.status) {
            query.andWhere('c.status = :status', { status: filters.status });
        }

        if (filters?.search) {
            query.andWhere(
                '(c.poNumber ILIKE :search OR c.vendorName ILIKE :search)',
                { search: `%${filters.search}%` },
            );
        }

        return query.getMany();
    }

    async findOne(id: string): Promise<RenewalContract> {
        const contract = await this.contractRepo.findOne({
            where: { id },
            relations: ['uploadedBy'],
        });

        if (!contract) {
            throw new NotFoundException(`Contract with ID ${id} not found`);
        }

        return contract;
    }

    async update(id: string, dto: UpdateContractDto): Promise<RenewalContract> {
        const contract = await this.findOne(id);

        // Update fields
        Object.assign(contract, dto);

        // Recalculate status if endDate changed
        if (dto.endDate) {
            contract.endDate = new Date(dto.endDate);
            contract.status = this.calculateStatus(contract.endDate);
        } else if (dto.endDate === null) {
            contract.status = ContractStatus.DRAFT;
        }

        return this.contractRepo.save(contract);
    }

    async delete(id: string): Promise<void> {
        const contract = await this.findOne(id);
        await this.contractRepo.remove(contract);
    }

    // === DASHBOARD STATS ===
    async getDashboardStats(): Promise<{
        total: number;
        active: number;
        expiringSoon: number;
        expired: number;
        draft: number;
    }> {
        const [total, active, expiringSoon, expired, draft] = await Promise.all([
            this.contractRepo.count(),
            this.contractRepo.count({ where: { status: ContractStatus.ACTIVE } }),
            this.contractRepo.count({ where: { status: ContractStatus.EXPIRING_SOON } }),
            this.contractRepo.count({ where: { status: ContractStatus.EXPIRED } }),
            this.contractRepo.count({ where: { status: ContractStatus.DRAFT } }),
        ]);

        return { total, active, expiringSoon, expired, draft };
    }

    // === STATUS CALCULATION ===
    private calculateStatus(endDate: Date): ContractStatus {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return ContractStatus.EXPIRED;
        if (diffDays <= 30) return ContractStatus.EXPIRING_SOON;
        return ContractStatus.ACTIVE;
    }

    // === FOR SCHEDULER (Phase 4) ===
    async findContractsNeedingReminder(daysUntilExpiry: number): Promise<RenewalContract[]> {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysUntilExpiry);
        targetDate.setHours(0, 0, 0, 0);

        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const reminderField = daysUntilExpiry === 30 ? 'reminderD30Sent'
                            : daysUntilExpiry === 7 ? 'reminderD7Sent'
                            : 'reminderD1Sent';

        return this.contractRepo
            .createQueryBuilder('c')
            .where('c.endDate >= :targetDate', { targetDate })
            .andWhere('c.endDate < :nextDay', { nextDay })
            .andWhere(`c.${reminderField} = false`)
            .andWhere('c.status != :draft', { draft: ContractStatus.DRAFT })
            .getMany();
    }

    async markReminderSent(id: string, days: 30 | 7 | 1): Promise<void> {
        const field = days === 30 ? 'reminderD30Sent'
                    : days === 7 ? 'reminderD7Sent'
                    : 'reminderD1Sent';

        await this.contractRepo.update(id, { [field]: true });
    }

    // === NIGHTLY STATUS UPDATE ===
    async updateAllStatuses(): Promise<number> {
        const contracts = await this.contractRepo.find({
            where: { endDate: Not(IsNull()) },
        });

        let updated = 0;
        for (const contract of contracts) {
            const newStatus = this.calculateStatus(contract.endDate);
            if (newStatus !== contract.status) {
                contract.status = newStatus;
                await this.contractRepo.save(contract);
                updated++;
            }
        }

        return updated;
    }
}
```

### 3.3 Renewal Controller

**File:** `apps/backend/src/modules/renewal/renewal.controller.ts`

```typescript
import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    UploadedFile,
    UseInterceptors,
    UseGuards,
    Req,
    ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RenewalService } from './renewal.service';
import { CreateContractDto, UpdateContractDto } from './dto/create-contract.dto';
import { ContractStatus } from './entities/renewal-contract.entity';

@ApiTags('Renewal Contracts')
@ApiBearerAuth()
@Controller('renewal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN') // === CRITICAL: Admin Only ===
export class RenewalController {
    constructor(private readonly renewalService: RenewalService) {}

    // === DASHBOARD STATS ===
    @Get('stats')
    async getStats() {
        return this.renewalService.getDashboardStats();
    }

    // === LIST ALL ===
    @Get()
    async findAll(
        @Query('status') status?: ContractStatus,
        @Query('search') search?: string,
    ) {
        return this.renewalService.findAll({ status, search });
    }

    // === GET ONE ===
    @Get(':id')
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.renewalService.findOne(id);
    }

    // === UPLOAD & EXTRACT ===
    @Post('upload')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    async upload(
        @UploadedFile() file: Express.Multer.File,
        @Req() req: any,
    ) {
        return this.renewalService.uploadAndExtract(file, req.user.id);
    }

    // === UPDATE (Manual Override) ===
    @Patch(':id')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateContractDto,
    ) {
        return this.renewalService.update(id, dto);
    }

    // === DELETE ===
    @Delete(':id')
    async delete(@Param('id', ParseUUIDPipe) id: string) {
        await this.renewalService.delete(id);
        return { message: 'Contract deleted successfully' };
    }
}
```

---

## PHASE 4: Scheduler Service (Estimated: 2-3 hours)

### 4.1 Renewal Scheduler Service

**File:** `apps/backend/src/modules/renewal/services/renewal-scheduler.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RenewalService } from '../renewal.service';
import { RenewalContract } from '../entities/renewal-contract.entity';

// EXTERNAL: Import existing notification services (READ-ONLY)
import { NotificationService } from '../../notifications/notification.service';
import { EmailChannelService } from '../../notifications/channels/email-channel.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class RenewalSchedulerService {
    private readonly logger = new Logger(RenewalSchedulerService.name);

    constructor(
        private readonly renewalService: RenewalService,
        private readonly notificationService: NotificationService,
        private readonly emailChannelService: EmailChannelService,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) {}

    // === DAILY JOB: Check Expiring Contracts (9 AM) ===
    @Cron('0 9 * * *', {
        name: 'renewal-reminder-check',
        timeZone: 'Asia/Jakarta',
    })
    async checkExpiringContracts() {
        this.logger.log('Running daily renewal reminder check...');

        try {
            // Check D-30, D-7, D-1
            await this.processReminders(30);
            await this.processReminders(7);
            await this.processReminders(1);

            // Update all statuses
            const updated = await this.renewalService.updateAllStatuses();
            this.logger.log(`Status update complete. ${updated} contracts updated.`);
        } catch (error) {
            this.logger.error('Renewal check failed:', error);
        }
    }

    private async processReminders(days: 30 | 7 | 1) {
        const contracts = await this.renewalService.findContractsNeedingReminder(days);
        
        if (contracts.length === 0) {
            this.logger.debug(`No contracts expiring in ${days} days`);
            return;
        }

        this.logger.log(`Found ${contracts.length} contracts expiring in ${days} days`);

        // Get all admin users
        const admins = await this.userRepo.find({ where: { role: 'ADMIN' as any } });

        for (const contract of contracts) {
            await this.sendReminderNotifications(contract, days, admins);
            await this.renewalService.markReminderSent(contract.id, days);
        }
    }

    private async sendReminderNotifications(
        contract: RenewalContract,
        daysUntilExpiry: number,
        admins: User[],
    ) {
        const urgency = daysUntilExpiry === 1 ? '🚨 URGENT' 
                      : daysUntilExpiry === 7 ? '⚠️ WARNING'
                      : '📅 REMINDER';

        const title = `${urgency}: Contract Expiring in ${daysUntilExpiry} Day(s)`;
        const message = `Contract "${contract.poNumber || contract.originalFileName}" ` +
                       `(Vendor: ${contract.vendorName || 'Unknown'}) ` +
                       `will expire on ${contract.endDate.toLocaleDateString('id-ID')}.`;

        // === IN-APP NOTIFICATION (Using existing NotificationService) ===
        // NOTE: We're using SYSTEM type since RENEWAL type doesn't exist
        // This avoids modifying the existing NotificationType enum
        for (const admin of admins) {
            await this.notificationService.create({
                userId: admin.id,
                type: NotificationType.SYSTEM,
                title,
                message,
                link: `/renewal/${contract.id}`,
            });
        }

        // === EMAIL NOTIFICATION ===
        for (const admin of admins) {
            if (admin.email) {
                await this.emailChannelService.send({
                    recipient: admin.email,
                    title,
                    body: message,
                    notificationId: contract.id,
                    data: {
                        contractId: contract.id,
                        link: `/renewal/${contract.id}`,
                    },
                });
            }
        }

        this.logger.log(`Sent ${daysUntilExpiry}-day reminder for contract ${contract.id}`);
    }
}
```

> **ISOLATION CHECK:** 
> - Menggunakan `NotificationType.SYSTEM` yang sudah ada
> - Tidak menambahkan enum baru ke NotificationType
> - Hanya memanggil method existing dari `NotificationService` dan `EmailChannelService`

---

## PHASE 5: Frontend Implementation (Estimated: 6-8 hours)

### 5.1 File Structure

**New Files to Create:**
```
apps/frontend/src/features/renewal/
├── pages/
│   └── RenewalDashboardPage.tsx    # Main dashboard
├── components/
│   ├── ContractCard.tsx            # Individual contract card
│   ├── ContractUploadModal.tsx     # Upload + review modal
│   ├── ContractEditForm.tsx        # Edit form for manual override
│   ├── ContractStats.tsx           # Stats cards (Active, Expiring, etc)
│   └── ContractTable.tsx           # Table view with sorting
├── hooks/
│   └── useRenewalApi.ts            # React Query hooks
└── types/
    └── renewal.types.ts            # TypeScript interfaces
```

### 5.2 TypeScript Types

**File:** `apps/frontend/src/features/renewal/types/renewal.types.ts`

```typescript
export enum ContractStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    EXPIRING_SOON = 'EXPIRING_SOON',
    EXPIRED = 'EXPIRED',
}

export interface RenewalContract {
    id: string;
    poNumber: string | null;
    vendorName: string | null;
    description: string | null;
    contractValue: number | null;
    startDate: string | null;
    endDate: string | null;
    originalFileName: string;
    filePath: string;
    fileSize: number;
    status: ContractStatus;
    extractionStrategy: string | null;
    extractionConfidence: number | null;
    uploadedBy: {
        id: string;
        fullName: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface DashboardStats {
    total: number;
    active: number;
    expiringSoon: number;
    expired: number;
    draft: number;
}

export interface ExtractionResult {
    poNumber: string | null;
    vendorName: string | null;
    startDate: string | null;
    endDate: string | null;
    contractValue: number | null;
    description: string | null;
    confidence: number;
    strategy: string;
}

export interface UploadResponse {
    contract: RenewalContract;
    extraction: ExtractionResult;
}
```

### 5.3 API Hooks

**File:** `apps/frontend/src/features/renewal/hooks/useRenewalApi.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { RenewalContract, DashboardStats, UploadResponse, ContractStatus } from '../types/renewal.types';

// Query Keys
export const renewalKeys = {
    all: ['renewal'] as const,
    list: (filters?: { status?: ContractStatus; search?: string }) => 
        [...renewalKeys.all, 'list', filters] as const,
    stats: () => [...renewalKeys.all, 'stats'] as const,
    detail: (id: string) => [...renewalKeys.all, 'detail', id] as const,
};

// === FETCH HOOKS ===
export function useRenewalStats() {
    return useQuery({
        queryKey: renewalKeys.stats(),
        queryFn: async () => {
            const res = await api.get<DashboardStats>('/renewal/stats');
            return res.data;
        },
    });
}

export function useRenewalContracts(filters?: { status?: ContractStatus; search?: string }) {
    return useQuery({
        queryKey: renewalKeys.list(filters),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.set('status', filters.status);
            if (filters?.search) params.set('search', filters.search);
            
            const res = await api.get<RenewalContract[]>(`/renewal?${params}`);
            return res.data;
        },
    });
}

export function useRenewalContract(id: string) {
    return useQuery({
        queryKey: renewalKeys.detail(id),
        queryFn: async () => {
            const res = await api.get<RenewalContract>(`/renewal/${id}`);
            return res.data;
        },
        enabled: !!id,
    });
}

// === MUTATION HOOKS ===
export function useUploadContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post<UploadResponse>('/renewal/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: renewalKeys.all });
        },
    });
}

export function useUpdateContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<RenewalContract> }) => {
            const res = await api.patch<RenewalContract>(`/renewal/${id}`, data);
            return res.data;
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: renewalKeys.all });
            queryClient.invalidateQueries({ queryKey: renewalKeys.detail(id) });
        },
    });
}

export function useDeleteContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/renewal/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: renewalKeys.all });
        },
    });
}
```

### 5.4 Add Route to App.tsx

**File:** `apps/frontend/src/App.tsx`

**ADD Lazy Import (after line 36):**
```typescript
const RenewalDashboardPage = lazy(() => import('./features/renewal/pages/RenewalDashboardPage').then(m => ({ default: m.RenewalDashboardPage })));
```

**ADD Route (after line 144, inside Admin/Agent routes):**
```typescript
<Route
    path="renewal"
    element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
            <FeatureErrorBoundary featureName="Renewal Reminders">
                <Suspense fallback={<PageLoader />}>
                    <RenewalDashboardPage />
                </Suspense>
            </FeatureErrorBoundary>
        </ProtectedRoute>
    }
/>
```

### 5.5 Add to Sidebar Navigation

**File:** `apps/frontend/src/components/layout/BentoSidebar.tsx`

**ADD Import (line 11):**
```typescript
import { CalendarClock } from 'lucide-react';
```

**ADD Menu Item (after line 35, inside the ADMIN block):**
```typescript
{ icon: CalendarClock, label: 'Renewal', path: '/renewal' },
```

---

## PHASE 6: Testing Checklist

### 6.1 Backend Unit Tests

```typescript
// apps/backend/src/modules/renewal/__tests__/pdf-extraction.service.spec.ts
describe('PdfExtractionService', () => {
    it('should extract Adobe pattern correctly', async () => {
        // Test with BAST Renewal Adobe file
    });

    it('should extract Allied pattern correctly', async () => {
        // Test with BAST RENEWAL ALLIED file
    });

    it('should return low confidence for unknown formats', async () => {
        // Test with random PDF
    });
});
```

### 6.2 Integration Tests

1. **Upload Flow:**
   - Upload PDF → Verify extraction result → Save contract → Check status

2. **Manual Override:**
   - Upload with failed extraction → Manual edit → Verify status updates

3. **Scheduler:**
   - Create contract with endDate = today + 30 → Run scheduler → Verify notifications sent

### 6.3 Frontend E2E Tests

1. **Admin Access:**
   - Verify only ADMIN can see "Renewal" menu
   - Verify AGENT gets 403 on `/renewal` route

2. **Upload & Review:**
   - Upload PDF → See extracted data → Edit fields → Save

3. **Dashboard:**
   - Verify stats cards show correct counts
   - Verify table filtering works

---

## ISOLATION VERIFICATION CHECKLIST

| Check | Status |
|-------|--------|
| No modification to `Ticket` entity | ✅ |
| No modification to `User` entity | ✅ |
| No modification to `Notification` entity | ✅ |
| No modification to `NotificationType` enum | ✅ |
| No modification to existing services | ✅ |
| Only IMPORTS existing services | ✅ |
| New entity in separate table `renewal_contracts` | ✅ |
| New module fully self-contained | ✅ |
| Sidebar addition is additive only | ✅ |
| Route addition is additive only | ✅ |

---

## RISK MITIGATION

### 1. Database Migration
- Gunakan TypeORM migration untuk production
- Jangan gunakan `synchronize: true` di production
- Test migration di staging dulu

### 2. PDF Parsing Failure
- Semua field extraction bersifat nullable
- Admin selalu bisa input manual
- Confidence score membantu admin tahu apakah perlu review

### 3. Email Delivery
- Reuse existing MailerModule config
- Log semua pengiriman di `notification_log` table
- Retry logic sudah ada di EmailChannelService

### 4. Scheduler Conflicts
- Cron job hanya INSERT ke notification table
- Tidak update/delete existing notifications
- Flag `reminderD30Sent`, dll mencegah duplicate

---

## EXECUTION ORDER

1. **Day 1 (Backend Core):** Phase 1 + Phase 2
2. **Day 2 (Backend API):** Phase 3 + Phase 4
3. **Day 3 (Frontend):** Phase 5
4. **Day 4 (Testing):** Phase 6 + Bug fixes

---

# Section 3: Notification Center Architecture (V3.1)

> **Date Added:** November 28, 2025  
> **Status:** 📋 SPECIFICATION READY

This section defines a centralized notification system that supports multiple categories with intelligent routing.

---

## 3.1 Notification Categorization & Data Structure

### Database Schema Enhancement

**Table: `notifications`** (Enhanced)

```sql
-- Add category column for segregation
ALTER TABLE notifications ADD COLUMN category VARCHAR(50) DEFAULT 'CATEGORY_TICKET';
ALTER TABLE notifications ADD COLUMN reference_id UUID;
ALTER TABLE notifications ADD INDEX idx_notifications_category (category);
ALTER TABLE notifications ADD INDEX idx_notifications_reference (reference_id);
```

**Updated Entity Definition:**

```typescript
// File: apps/backend/src/modules/notifications/entities/notification.entity.ts

export enum NotificationCategory {
    CATEGORY_TICKET = 'CATEGORY_TICKET',   // Support ticket updates
    CATEGORY_RENEWAL = 'CATEGORY_RENEWAL', // Contract/license expirations
}

export enum NotificationType {
    // Existing types...
    TICKET_CREATED = 'TICKET_CREATED',
    TICKET_ASSIGNED = 'TICKET_ASSIGNED',
    TICKET_UPDATED = 'TICKET_UPDATED',
    TICKET_RESOLVED = 'TICKET_RESOLVED',
    TICKET_CANCELLED = 'TICKET_CANCELLED',
    TICKET_REPLY = 'TICKET_REPLY',
    MENTION = 'MENTION',
    SLA_WARNING = 'SLA_WARNING',
    SLA_BREACHED = 'SLA_BREACHED',
    SYSTEM = 'SYSTEM',
    
    // NEW: Renewal-specific types
    RENEWAL_D60_WARNING = 'RENEWAL_D60_WARNING',   // 2-month early warning
    RENEWAL_D30_WARNING = 'RENEWAL_D30_WARNING',   // 30-day warning
    RENEWAL_D7_WARNING = 'RENEWAL_D7_WARNING',     // 7-day warning
    RENEWAL_D1_WARNING = 'RENEWAL_D1_WARNING',     // 1-day critical
    RENEWAL_EXPIRED = 'RENEWAL_EXPIRED',           // Contract expired
}

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({
        type: 'enum',
        enum: NotificationType,
        default: NotificationType.SYSTEM,
    })
    type: NotificationType;

    // NEW: Category for filtering
    @Index('idx_notification_category')
    @Column({
        type: 'enum',
        enum: NotificationCategory,
        default: NotificationCategory.CATEGORY_TICKET,
    })
    category: NotificationCategory;

    @Column()
    title: string;

    @Column('text')
    message: string;

    // EXISTING: For backwards compatibility
    @Column({ nullable: true })
    ticketId?: string;

    // NEW: Generic reference for any entity
    @Index('idx_notification_reference')
    @Column({ type: 'uuid', nullable: true })
    referenceId?: string;

    @Column({ nullable: true })
    link?: string;

    @Column({ default: false })
    isRead: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
```

### Category Mapping Logic

```typescript
// File: apps/backend/src/modules/notifications/utils/category-mapper.ts

export function getCategoryFromType(type: NotificationType): NotificationCategory {
    const renewalTypes = [
        NotificationType.RENEWAL_D60_WARNING,
        NotificationType.RENEWAL_D30_WARNING,
        NotificationType.RENEWAL_D7_WARNING,
        NotificationType.RENEWAL_D1_WARNING,
        NotificationType.RENEWAL_EXPIRED,
    ];

    return renewalTypes.includes(type) 
        ? NotificationCategory.CATEGORY_RENEWAL 
        : NotificationCategory.CATEGORY_TICKET;
}
```

---

## 3.2 Intelligent Routing (Deep Linking)

### Routing Configuration

```typescript
// File: apps/backend/src/modules/notifications/config/notification-routes.ts

export interface NotificationRoute {
    category: NotificationCategory;
    baseUrl: string;
    paramKey: string;
}

export const NOTIFICATION_ROUTES: Record<NotificationCategory, NotificationRoute> = {
    [NotificationCategory.CATEGORY_TICKET]: {
        category: NotificationCategory.CATEGORY_TICKET,
        baseUrl: '/ticket/view',
        paramKey: 'ticketId',
    },
    [NotificationCategory.CATEGORY_RENEWAL]: {
        category: NotificationCategory.CATEGORY_RENEWAL,
        baseUrl: '/renewal/detail',
        paramKey: 'referenceId',
    },
};

// Generates deep link based on notification
export function generateDeepLink(notification: Notification): string {
    const route = NOTIFICATION_ROUTES[notification.category];
    
    if (notification.category === NotificationCategory.CATEGORY_TICKET) {
        return `${route.baseUrl}/${notification.ticketId}`;
    }
    
    if (notification.category === NotificationCategory.CATEGORY_RENEWAL) {
        return `${route.baseUrl}/${notification.referenceId}`;
    }
    
    // Fallback to link field
    return notification.link || '/notifications';
}
```

### Frontend Navigation Handler

```typescript
// File: apps/frontend/src/features/notifications/utils/notificationRouter.ts

import { NotificationCategory } from '../types/notification.types';

interface NotificationItem {
    id: string;
    category: NotificationCategory;
    ticketId?: string;
    referenceId?: string;
    link?: string;
}

export function getNotificationRedirectPath(notification: NotificationItem): string {
    switch (notification.category) {
        case 'CATEGORY_TICKET':
            return notification.ticketId 
                ? `/ticket/view/${notification.ticketId}` 
                : '/tickets';
        
        case 'CATEGORY_RENEWAL':
            return notification.referenceId 
                ? `/renewal/detail/${notification.referenceId}` 
                : '/renewal';
        
        default:
            return notification.link || '/dashboard';
    }
}

// Usage in NotificationItem component:
// onClick={() => navigate(getNotificationRedirectPath(notification))}
```

---

## 3.3 Tabbed Interface UI Implementation

### Frontend Component

```tsx
// File: apps/frontend/src/features/notifications/components/NotificationCenter.tsx

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Ticket, CalendarClock } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationCategory } from '../types/notification.types';
import { NotificationList } from './NotificationList';

type TabValue = 'all' | 'tickets' | 'renewals';

export function NotificationCenter() {
    const [activeTab, setActiveTab] = useState<TabValue>('all');
    
    // Fetch with category filter
    const categoryFilter = activeTab === 'all' 
        ? undefined 
        : activeTab === 'tickets' 
            ? NotificationCategory.CATEGORY_TICKET 
            : NotificationCategory.CATEGORY_RENEWAL;
    
    const { data: notifications, isLoading } = useNotifications({ category: categoryFilter });

    return (
        <div className="w-full max-w-md mx-auto">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="all" className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        All
                    </TabsTrigger>
                    <TabsTrigger value="tickets" className="flex items-center gap-2">
                        <Ticket className="h-4 w-4" />
                        Tickets
                    </TabsTrigger>
                    <TabsTrigger value="renewals" className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        Renewals
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                    <NotificationList notifications={notifications} isLoading={isLoading} />
                </TabsContent>
                <TabsContent value="tickets">
                    <NotificationList notifications={notifications} isLoading={isLoading} />
                </TabsContent>
                <TabsContent value="renewals">
                    <NotificationList notifications={notifications} isLoading={isLoading} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
```

### API Endpoint Enhancement

```typescript
// File: apps/backend/src/modules/notifications/notification.controller.ts

@Get()
async findAll(
    @Req() req: any,
    @Query('category') category?: NotificationCategory,
    @Query('isRead') isRead?: boolean,
    @Query('limit') limit?: number,
) {
    return this.notificationService.findByUser(req.user.id, {
        category,
        isRead: isRead !== undefined ? isRead === true : undefined,
        limit: limit || 50,
    });
}

// Service implementation
async findByUser(
    userId: string, 
    filters?: { category?: NotificationCategory; isRead?: boolean; limit?: number }
): Promise<Notification[]> {
    const query = this.notificationRepo
        .createQueryBuilder('n')
        .where('n.userId = :userId', { userId })
        .orderBy('n.createdAt', 'DESC');

    if (filters?.category) {
        query.andWhere('n.category = :category', { category: filters.category });
    }

    if (filters?.isRead !== undefined) {
        query.andWhere('n.isRead = :isRead', { isRead: filters.isRead });
    }

    if (filters?.limit) {
        query.take(filters.limit);
    }

    return query.getMany();
}
```

---

# Section 4: Enhanced Renewal Logic & Cron Jobs (V3.2)

> **Key Change:** Early warning now triggers at **60 days (2 months)** instead of 30 days.

---

## 4.1 Updated Reminder Schedule

| Reminder | Days Before Expiry | Flag Field | Priority |
|----------|-------------------|------------|----------|
| **D-60** | 60 days (2 months) | `reminderD60Sent` | LOW |
| **D-30** | 30 days | `reminderD30Sent` | MEDIUM |
| **D-7** | 7 days | `reminderD7Sent` | HIGH |
| **D-1** | 1 day | `reminderD1Sent` | CRITICAL |

### Entity Update (Add D-60 Flag)

```typescript
// File: apps/backend/src/modules/renewal/entities/renewal-contract.entity.ts

// ADD after existing reminder flags
@Column({ default: false })
reminderD60Sent: boolean;  // NEW: 2-month early warning

@Column({ default: false })
reminderD30Sent: boolean;

@Column({ default: false })
reminderD7Sent: boolean;

@Column({ default: false })
reminderD1Sent: boolean;

// NEW: Acknowledge functionality
@Column({ default: false })
isAcknowledged: boolean;

@Column({ type: 'timestamp', nullable: true })
acknowledgedAt: Date;

@Column({ nullable: true })
acknowledgedById: string;

@ManyToOne(() => User, { nullable: true })
@JoinColumn({ name: 'acknowledgedById' })
acknowledgedBy: User;
```

---

## 4.2 Acknowledge Feature

### State Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONTRACT LIFECYCLE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   [ACTIVE]  →  D-60 Reminder  →  Daily Reminders Continue       │
│      │                               │                           │
│      ↓                               ↓                           │
│   (User clicks "Acknowledge")   [No Action]                      │
│      │                               │                           │
│      ↓                               ↓                           │
│   isAcknowledged = true         Continue D-30, D-7, D-1         │
│   STOP DAILY REMINDERS          reminders as scheduled           │
│      │                               │                           │
│      └───────────────────────────────┘                           │
│                        │                                         │
│                        ↓                                         │
│              Contract expires → Status: EXPIRED                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Backend Implementation

```typescript
// File: apps/backend/src/modules/renewal/renewal.service.ts

// ADD new method
async acknowledgeContract(id: string, userId: string): Promise<RenewalContract> {
    const contract = await this.findOne(id);
    
    if (contract.isAcknowledged) {
        throw new BadRequestException('Contract already acknowledged');
    }

    contract.isAcknowledged = true;
    contract.acknowledgedAt = new Date();
    contract.acknowledgedById = userId;

    this.logger.log(`Contract ${id} acknowledged by user ${userId}`);
    
    return this.contractRepo.save(contract);
}

// UPDATE findContractsNeedingReminder to exclude acknowledged
async findContractsNeedingReminder(daysUntilExpiry: number): Promise<RenewalContract[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysUntilExpiry);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const reminderField = daysUntilExpiry === 60 ? 'reminderD60Sent'
        : daysUntilExpiry === 30 ? 'reminderD30Sent'
        : daysUntilExpiry === 7 ? 'reminderD7Sent'
        : 'reminderD1Sent';

    return this.contractRepo
        .createQueryBuilder('c')
        .where('c.endDate >= :targetDate', { targetDate })
        .andWhere('c.endDate < :nextDay', { nextDay })
        .andWhere(`c.${reminderField} = false`)
        .andWhere('c.status != :draft', { draft: ContractStatus.DRAFT })
        .andWhere('c.isAcknowledged = false')  // SKIP acknowledged contracts
        .getMany();
}
```

### Controller Endpoint

```typescript
// File: apps/backend/src/modules/renewal/renewal.controller.ts

@Post(':id/acknowledge')
async acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
) {
    return this.renewalService.acknowledgeContract(id, req.user.id);
}
```

### Frontend UI (Renewal Detail Page)

```tsx
// File: apps/frontend/src/features/renewal/components/AcknowledgeButton.tsx

import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAcknowledgeContract } from '../hooks/useRenewalApi';
import { RenewalContract } from '../types/renewal.types';

interface Props {
    contract: RenewalContract;
}

export function AcknowledgeButton({ contract }: Props) {
    const { mutate: acknowledge, isPending } = useAcknowledgeContract();

    if (contract.isAcknowledged) {
        return (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-md">
                <CheckCircle className="h-5 w-5" />
                <span>
                    Acknowledged on {new Date(contract.acknowledgedAt).toLocaleDateString()}
                </span>
            </div>
        );
    }

    return (
        <Button
            onClick={() => acknowledge(contract.id)}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700"
        >
            <CheckCircle className="h-4 w-4 mr-2" />
            {isPending ? 'Processing...' : 'Acknowledge Renewal'}
        </Button>
    );
}
```

---

## 4.3 Updated Scheduler (60-Day Early Warning)

### Cron Job Pseudocode

```
┌────────────────────────────────────────────────────────────────┐
│                DAILY RENEWAL REMINDER JOB                       │
│                Runs: 9:00 AM (Asia/Jakarta)                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. FUNCTION checkExpiringContracts():                          │
│     │                                                           │
│     ├─► FOR each milestone IN [60, 30, 7, 1]:                   │
│     │   │                                                       │
│     │   ├─► targetDate = TODAY + milestone days                 │
│     │   │                                                       │
│     │   ├─► contracts = SELECT * FROM renewal_contracts         │
│     │   │   WHERE endDate = targetDate                          │
│     │   │     AND reminderD{milestone}Sent = false              │
│     │   │     AND status != 'DRAFT'                             │
│     │   │     AND isAcknowledged = false                        │
│     │   │                                                       │
│     │   ├─► FOR each contract:                                  │
│     │   │   ├─► Send in-app notification to ALL admins          │
│     │   │   ├─► Send email notification to ALL admins           │
│     │   │   └─► UPDATE contract SET reminderD{milestone}Sent=1  │
│     │   │                                                       │
│     │   └─► LOG "Processed {count} contracts for D-{milestone}" │
│     │                                                           │
│     ├─► UPDATE status for all contracts (ACTIVE→EXPIRING→EXPIRED)
│     │                                                           │
│     └─► LOG "Daily renewal check complete"                      │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// File: apps/backend/src/modules/renewal/services/renewal-scheduler.service.ts

@Cron('0 9 * * *', {
    name: 'renewal-reminder-check',
    timeZone: 'Asia/Jakarta',
})
async checkExpiringContracts() {
    this.logger.log('Running daily renewal reminder check...');

    try {
        // Check D-60, D-30, D-7, D-1
        await this.processReminders(60);  // NEW: 2-month early warning
        await this.processReminders(30);
        await this.processReminders(7);
        await this.processReminders(1);

        // Update all statuses
        const updated = await this.renewalService.updateAllStatuses();
        this.logger.log(`Status update complete. ${updated} contracts updated.`);
    } catch (error) {
        this.logger.error('Renewal check failed:', error);
    }
}

private async processReminders(days: 60 | 30 | 7 | 1) {
    const contracts = await this.renewalService.findContractsNeedingReminder(days);
    
    if (contracts.length === 0) {
        this.logger.debug(`No contracts expiring in ${days} days`);
        return;
    }

    this.logger.log(`Found ${contracts.length} contracts expiring in ${days} days`);

    const admins = await this.userRepo.find({ where: { role: 'ADMIN' as any } });

    for (const contract of contracts) {
        await this.sendReminderNotifications(contract, days, admins);
        await this.renewalService.markReminderSent(contract.id, days as 60 | 30 | 7 | 1);
    }
}
```

---

# Section 5: PDF Upload Guardrails (Anti-Scan Logic)

> **Objective:** Prevent users from uploading flattened/scanned image PDFs that cannot be reliably extracted.

---

## 5.1 Validation Logic

### Character Count Threshold

| Condition | Text Characters | Action |
|-----------|----------------|--------|
| **Valid PDF** | ≥ 50 characters | Proceed with extraction |
| **Scanned/Image PDF** | < 50 characters | Return warning, allow override |

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    PDF UPLOAD FLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   [User uploads PDF]                                         │
│          │                                                   │
│          ↓                                                   │
│   ┌──────────────────┐                                       │
│   │ Extract text     │                                       │
│   │ using pdf-parse  │                                       │
│   └────────┬─────────┘                                       │
│            │                                                 │
│            ↓                                                 │
│   ┌──────────────────────────┐                               │
│   │ Text length >= 50 chars? │                               │
│   └────────┬────────┬────────┘                               │
│            │        │                                        │
│         YES│        │NO                                      │
│            │        │                                        │
│            ↓        ↓                                        │
│   ┌────────────┐  ┌─────────────────────────────────────┐   │
│   │ Continue   │  │ Return warning:                      │   │
│   │ extraction │  │ "This file appears to be a scanned  │   │
│   │ process    │  │  image. Please upload a digital PDF │   │
│   └────────────┘  │  with selectable text..."           │   │
│                   └─────────────────────────────────────┘   │
│                            │                                 │
│                            ↓                                 │
│                   [User can override & continue              │
│                    with manual entry]                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5.2 Backend Implementation (Node.js/NestJS)

```typescript
// File: apps/backend/src/modules/renewal/services/pdf-validation.service.ts

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';

const pdfParse = require('pdf-parse');

export interface PdfValidationResult {
    isValid: boolean;
    characterCount: number;
    isScannedImage: boolean;
    warningMessage?: string;
    rawTextPreview?: string;
}

@Injectable()
export class PdfValidationService {
    private readonly logger = new Logger(PdfValidationService.name);
    
    // Minimum characters to consider PDF as having extractable text
    private readonly MIN_TEXT_THRESHOLD = 50;

    async validatePdf(filePath: string): Promise<PdfValidationResult> {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            
            // Clean text: remove excessive whitespace
            const cleanedText = pdfData.text
                .replace(/\s+/g, ' ')
                .trim();
            
            const characterCount = cleanedText.length;
            const isScannedImage = characterCount < this.MIN_TEXT_THRESHOLD;

            this.logger.debug(
                `PDF validation: ${characterCount} chars extracted ` +
                `(threshold: ${this.MIN_TEXT_THRESHOLD})`
            );

            if (isScannedImage) {
                return {
                    isValid: false,
                    characterCount,
                    isScannedImage: true,
                    warningMessage: 
                        'Warning: This file appears to be a scanned image. ' +
                        'Please upload a digital PDF with selectable text ' +
                        'to ensure accurate data extraction.',
                    rawTextPreview: cleanedText.substring(0, 200),
                };
            }

            return {
                isValid: true,
                characterCount,
                isScannedImage: false,
                rawTextPreview: cleanedText.substring(0, 200),
            };
        } catch (error) {
            this.logger.error(`PDF validation failed: ${error.message}`);
            
            return {
                isValid: false,
                characterCount: 0,
                isScannedImage: true,
                warningMessage: 
                    'Error: Unable to read PDF content. ' +
                    'The file may be corrupted or password-protected.',
            };
        }
    }
}
```

### Integration with Upload Controller

```typescript
// File: apps/backend/src/modules/renewal/renewal.controller.ts

@Post('upload')
@ApiConsumes('multipart/form-data')
@UseInterceptors(FileInterceptor('file'))
async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Query('forceUpload') forceUpload?: boolean, // Allow override
) {
    // Step 1: Validate PDF for scanned images
    const validation = await this.pdfValidationService.validatePdf(file.path);
    
    if (!validation.isValid && !forceUpload) {
        // Return warning but don't reject - let user decide
        return {
            success: false,
            warning: validation.warningMessage,
            validation: {
                characterCount: validation.characterCount,
                isScannedImage: validation.isScannedImage,
            },
            message: 'Add ?forceUpload=true to proceed with manual entry',
        };
    }

    // Step 2: Continue with normal extraction
    return this.renewalService.uploadAndExtract(file, req.user.id);
}
```

---

## 5.3 Frontend Implementation

### Upload Modal with Validation Warning

```tsx
// File: apps/frontend/src/features/renewal/components/ContractUploadModal.tsx

interface ValidationWarning {
    characterCount: number;
    isScannedImage: boolean;
}

export function ContractUploadModal({ isOpen, onClose }) {
    const [validationWarning, setValidationWarning] = useState<ValidationWarning | null>(null);
    const [showWarningDialog, setShowWarningDialog] = useState(false);
    const { mutateAsync: uploadContract, isPending } = useUploadContract();

    const handleUpload = async (file: File, forceUpload = false) => {
        try {
            const result = await uploadContract({ file, forceUpload });
            
            if (result.warning && !forceUpload) {
                // Show warning dialog
                setValidationWarning(result.validation);
                setShowWarningDialog(true);
                return;
            }

            // Success - close modal
            toast.success('Contract uploaded successfully');
            onClose();
        } catch (error) {
            toast.error('Upload failed');
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                {/* ... existing upload UI ... */}
            </Dialog>

            {/* Scanned Image Warning Dialog */}
            <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="h-5 w-5" />
                            Scanned Image Detected
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <p className="mb-4">
                                This file appears to be a scanned image PDF. 
                                Only <strong>{validationWarning?.characterCount}</strong> characters 
                                were detected, which suggests the text cannot be reliably extracted.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                For best results, please upload a digital PDF with selectable text. 
                                If you proceed, you will need to enter contract details manually.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowWarningDialog(false)}>
                            Cancel & Upload Different File
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={() => handleUpload(currentFile, true)}
                            className="bg-amber-600 hover:bg-amber-700"
                        >
                            Proceed with Manual Entry
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
```

---

## 5.4 Alternative: Python Implementation

For systems using Python backend:

```python
# File: services/pdf_validation.py

import fitz  # PyMuPDF
from dataclasses import dataclass
from typing import Optional

@dataclass
class PdfValidationResult:
    is_valid: bool
    character_count: int
    is_scanned_image: bool
    warning_message: Optional[str] = None
    raw_text_preview: Optional[str] = None

MIN_TEXT_THRESHOLD = 50

def validate_pdf(file_path: str) -> PdfValidationResult:
    """
    Validates if a PDF has extractable text or is a scanned image.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        PdfValidationResult with validation details
    """
    try:
        doc = fitz.open(file_path)
        full_text = ""
        
        for page in doc:
            full_text += page.get_text()
        
        doc.close()
        
        # Clean text
        cleaned_text = " ".join(full_text.split())
        character_count = len(cleaned_text)
        is_scanned_image = character_count < MIN_TEXT_THRESHOLD
        
        if is_scanned_image:
            return PdfValidationResult(
                is_valid=False,
                character_count=character_count,
                is_scanned_image=True,
                warning_message=(
                    "Warning: This file appears to be a scanned image. "
                    "Please upload a digital PDF with selectable text "
                    "to ensure accurate data extraction."
                ),
                raw_text_preview=cleaned_text[:200]
            )
        
        return PdfValidationResult(
            is_valid=True,
            character_count=character_count,
            is_scanned_image=False,
            raw_text_preview=cleaned_text[:200]
        )
        
    except Exception as e:
        return PdfValidationResult(
            is_valid=False,
            character_count=0,
            is_scanned_image=True,
            warning_message=f"Error: Unable to read PDF content. {str(e)}"
        )


# Usage example:
# result = validate_pdf("/uploads/contract.pdf")
# if not result.is_valid:
#     return {"warning": result.warning_message}
```

---

# Section 6: Implementation Summary

## 6.1 Database Migration Script

```sql
-- Migration: Add notification center enhancements
-- Version: 3.1.0

-- Step 1: Add category to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'CATEGORY_TICKET';

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_id);

-- Step 2: Add D-60 reminder and acknowledge fields to renewal_contracts
ALTER TABLE renewal_contracts 
ADD COLUMN IF NOT EXISTS reminder_d60_sent BOOLEAN DEFAULT false;

ALTER TABLE renewal_contracts 
ADD COLUMN IF NOT EXISTS is_acknowledged BOOLEAN DEFAULT false;

ALTER TABLE renewal_contracts 
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP;

ALTER TABLE renewal_contracts 
ADD COLUMN IF NOT EXISTS acknowledged_by_id UUID REFERENCES users(id);

-- Step 3: Backfill existing notifications with category
UPDATE notifications 
SET category = 'CATEGORY_TICKET' 
WHERE category IS NULL;
```

## 6.2 Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `notification.entity.ts` | MODIFY | Add `category`, `referenceId` fields |
| `notification.controller.ts` | MODIFY | Add category filter to `findAll` |
| `notification.service.ts` | MODIFY | Update queries for category filtering |
| `NotificationCenter.tsx` | CREATE | Tabbed interface component |
| `notificationRouter.ts` | CREATE | Deep link routing utility |
| `renewal-contract.entity.ts` | MODIFY | Add `reminderD60Sent`, acknowledge fields |
| `renewal.service.ts` | MODIFY | Add `acknowledgeContract` method |
| `renewal-scheduler.service.ts` | MODIFY | Add D-60 processing |
| `pdf-validation.service.ts` | CREATE | Anti-scan validation logic |
| `ContractUploadModal.tsx` | MODIFY | Add validation warning UI |

## 6.3 Estimated Implementation Time

| Phase | Task | Time |
|-------|------|------|
| **Phase A** | Database migration + Entity updates | 2 hours |
| **Phase B** | Notification Center backend | 3 hours |
| **Phase C** | Notification Center frontend (tabs + routing) | 4 hours |
| **Phase D** | Renewal D-60 + Acknowledge feature | 3 hours |
| **Phase E** | PDF Validation service | 2 hours |
| **Phase F** | Testing & QA | 4 hours |
| | **Total** | **18 hours** |

---

> **Document Version:** 3.1.0  
> **Last Updated:** November 28, 2025  
> **Author:** Senior Full-Stack Developer & UX Architect
