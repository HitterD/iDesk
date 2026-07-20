# HRIS Gateway NIK Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karyawan login ke iDesk pakai NIK HRIS (verify ke API Gateway `10.10.6.51:27080`), 4.735 karyawan di-provision otomatis (sync massal + just-in-time), login email lama tetap utuh.

**Architecture:** Modul backend baru `hris-gateway` (axios adapter + sync service + cron + admin endpoint) mengikuti pola `zoom-api.adapter.ts`. `AuthService.validateUserWithDetails` dapat satu cabang baru: identifier tanpa `@` = NIK → verify Gateway → fallback password lokal → find-or-create user by `employeeId`. Frontend hanya ganti label/validasi field login.

**Tech Stack:** NestJS 10, TypeORM (PostgreSQL), Passport local strategy, axios (sudah ter-resolve di node_modules, dipakai `zoom-api.adapter.ts`), `@nestjs/schedule` (sudah terpasang), bcrypt, Jest. Frontend React + vite.

**Spec:** `docs/superpowers/specs/2026-07-20-hris-gateway-login-design.md`

## Global Constraints

- TIDAK ada migration DB — `User.employeeId` sudah ada, dipakai sebagai NIK HRIS.
- TIDAK ada dependency npm baru.
- Login email existing TIDAK boleh berubah perilakunya (regression = gagal).
- API key HANYA di env backend: `HRIS_GATEWAY_API_KEY`. JANGAN hardcode/commit key asli.
- Env vars: `HRIS_GATEWAY_BASE_URL=http://10.10.6.51:27080/api/v1`, `HRIS_GATEWAY_API_KEY`.
- Mapping site: `SJA-1→SPJ`, `SJA-3→SPJ`, `SJA-2→KRW`, `SJA-SMG→SMG`, `SJA-JKT→JTB`, lainnya → null.
- Mapping role: `nama_departemen` diawali `SECURITY & NETWORK INFRASTURCTURE` → `AGENT_OPERATIONAL_SUPPORT` (perhatikan typo HRIS: INFRASTURCTURE); persis `INFORMATION SYSTEM DEVELOPMENT` → `AGENT_ORACLE`; lainnya → `USER`.
- Password default: `123456` (konstanta `DEFAULT_HRIS_PASSWORD`), selalu disimpan bcrypt.
- Sync TIDAK meng-overwrite `password`, `role`, `email`, `isActive` user yang sudah ada.
- `AGENT_OPERATIONAL_SUPPORT` mendapat akses kerja setara legacy `AGENT` pada fitur operasional. `AGENT_ORACLE` mendapat dashboard dan endpoint Oracle/K2 saja; keduanya bukan ADMIN dan tidak mendapat endpoint administrasi.
- Semua guard/redirect/query yang semantik-nya "agent operasional" wajib memakai daftar role yang sama: `[ADMIN, AGENT, AGENT_OPERATIONAL_SUPPORT]`. Endpoint/query Oracle memakai `[ADMIN, AGENT_ORACLE]`. Hindari memberi kedua role akses endpoint lama hanya karena endpoint itu pernah menerima `AGENT`.
- Gateway response nyata (terverifikasi): `POST /auth/verify` → HTTP 201 `{valid, eligible, match}`; `GET /employees?page=N` → `{data: HrisEmployee[50], total: 4736}` (param `limit`/`offset` TIDAK didukung); `GET /employees/:nik` → satu objek employee; koneksi kadang drop (HTTP 000) → GET wajib retry.
- Semua command backend dijalankan dari `apps/backend`; frontend dari `apps/frontend`.

---

### Task 1: Mapping konstanta HRIS (`hris-mapping.ts`)

**Files:**
- Create: `apps/backend/src/modules/hris-gateway/hris-mapping.ts`
- Test: `apps/backend/src/modules/hris-gateway/hris-mapping.spec.ts`

**Interfaces:**
- Consumes: `UserRole` dari `../users/enums/user-role.enum`.
- Produces: `LOKASI_TO_SITE_CODE: Record<string,string>`, `DEFAULT_HRIS_PASSWORD: string`, `resolveRole(namaDepartemen?: string|null): UserRole`, `resolveSiteCode(lokasi?: string|null): string|null`. Dipakai Task 3 (sync) dan Task 4 (auth JIT).

- [ ] **Step 1: Tulis failing test**

`apps/backend/src/modules/hris-gateway/hris-mapping.spec.ts`:

```typescript
import { resolveRole, resolveSiteCode, DEFAULT_HRIS_PASSWORD, LOKASI_TO_SITE_CODE } from './hris-mapping';
import { UserRole } from '../users/enums/user-role.enum';

describe('hris-mapping', () => {
    describe('resolveSiteCode', () => {
        it.each([
            ['SJA-1', 'SPJ'],
            ['SJA-3', 'SPJ'],
            ['SJA-2', 'KRW'],
            ['SJA-SMG', 'SMG'],
            ['SJA-JKT', 'JTB'],
        ])('%s -> %s', (lokasi, expected) => {
            expect(resolveSiteCode(lokasi)).toBe(expected);
        });

        it('lokasi tak dikenal / null -> null', () => {
            expect(resolveSiteCode('SJA-99')).toBeNull();
            expect(resolveSiteCode(null)).toBeNull();
            expect(resolveSiteCode(undefined)).toBeNull();
        });

        it('case-insensitive dan trim', () => {
            expect(resolveSiteCode(' sja-1 ')).toBe('SPJ');
        });
    });

    describe('resolveRole', () => {
        it('SECURITY & NETWORK INFRASTURCTURE (pusat) -> AGENT_OPERATIONAL_SUPPORT', () => {
            expect(resolveRole('SECURITY & NETWORK INFRASTURCTURE')).toBe(UserRole.AGENT_OPERATIONAL_SUPPORT);
        });

        it('varian AREA -> AGENT_OPERATIONAL_SUPPORT', () => {
            expect(resolveRole('SECURITY & NETWORK INFRASTURCTURE AREA - SEPANJANG')).toBe(UserRole.AGENT_OPERATIONAL_SUPPORT);
            expect(resolveRole('SECURITY & NETWORK INFRASTURCTURE AREA - JAKARTA')).toBe(UserRole.AGENT_OPERATIONAL_SUPPORT);
        });

        it('INFORMATION SYSTEM DEVELOPMENT -> AGENT_ORACLE', () => {
            expect(resolveRole('INFORMATION SYSTEM DEVELOPMENT')).toBe(UserRole.AGENT_ORACLE);
        });

        it('departemen lain -> USER (termasuk ICT demo & MARKETING INFORMATION SYSTEM)', () => {
            expect(resolveRole('ICT')).toBe(UserRole.USER);
            expect(resolveRole('ICT KARAWANG TEST')).toBe(UserRole.USER);
            expect(resolveRole('MARKETING INFORMATION SYSTEM')).toBe(UserRole.USER);
            expect(resolveRole('PROCUREMENT')).toBe(UserRole.USER);
            expect(resolveRole(null)).toBe(UserRole.USER);
        });
    });

    it('DEFAULT_HRIS_PASSWORD adalah 123456', () => {
        expect(DEFAULT_HRIS_PASSWORD).toBe('123456');
    });

    it('mapping lokasi lengkap 5 entri', () => {
        expect(Object.keys(LOKASI_TO_SITE_CODE)).toHaveLength(5);
    });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/backend && npx jest hris-mapping --runInBand`
Expected: FAIL — `Cannot find module './hris-mapping'`

- [ ] **Step 3: Implementasi minimal**

`apps/backend/src/modules/hris-gateway/hris-mapping.ts`:

```typescript
import { UserRole } from '../users/enums/user-role.enum';

// Mapping lokasi HRIS -> Site.code iDesk (spec 2026-07-20-hris-gateway-login-design.md)
export const LOKASI_TO_SITE_CODE: Record<string, string> = {
    'SJA-1': 'SPJ',
    'SJA-3': 'SPJ',
    'SJA-2': 'KRW',
    'SJA-SMG': 'SMG',
    'SJA-JKT': 'JTB',
};

export const DEFAULT_HRIS_PASSWORD = '123456';

// "INFRASTURCTURE" adalah ejaan persis di data HRIS, jangan "dikoreksi"
const SNI_PREFIX = 'SECURITY & NETWORK INFRASTURCTURE';
const ISD_EXACT = 'INFORMATION SYSTEM DEVELOPMENT';

export function resolveSiteCode(lokasi?: string | null): string | null {
    const key = (lokasi || '').toUpperCase().trim();
    return LOKASI_TO_SITE_CODE[key] ?? null;
}

export function resolveRole(namaDepartemen?: string | null): UserRole {
    const dept = (namaDepartemen || '').toUpperCase().trim();
    if (dept.startsWith(SNI_PREFIX)) return UserRole.AGENT_OPERATIONAL_SUPPORT;
    if (dept === ISD_EXACT) return UserRole.AGENT_ORACLE;
    return UserRole.USER;
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `cd apps/backend && npx jest hris-mapping --runInBand`
Expected: PASS (semua)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hris-gateway/hris-mapping.ts apps/backend/src/modules/hris-gateway/hris-mapping.spec.ts
git commit -m "feat(hris): add lokasi->site and departemen->role mapping constants"
```

---

### Task 2: Gateway adapter + env

**Files:**
- Create: `apps/backend/src/modules/hris-gateway/hris-gateway.adapter.ts`
- Modify: `apps/backend/.env.example` (append di akhir file)
- Modify: `.env.example` (root — append blok yang sama)
- Test: `apps/backend/src/modules/hris-gateway/hris-gateway.adapter.spec.ts`

**Interfaces:**
- Consumes: env `HRIS_GATEWAY_BASE_URL`, `HRIS_GATEWAY_API_KEY`; axios.
- Produces (dipakai Task 3 & 4):
  - `interface HrisEmployee { nik_hris: string; nik_santos: string | null; nama_karyawan: string; id_departemen: string | null; nama_departemen: string | null; nama_jabatan: string | null; email: string | null; lokasi: string | null; tgl_keluar: string | null; }`
  - `interface HrisVerifyResult { valid: boolean; eligible: boolean; match: boolean; }`
  - `interface HrisEmployeesPage { data: HrisEmployee[]; total: number; }`
  - `class HrisGatewayAdapter`: `isConfigured(): boolean`, `ping(): Promise<boolean>`, `verifyPassword(nik: string, password: string): Promise<HrisVerifyResult | null>` (null = Gateway unreachable/error, BUKAN password salah), `getEmployee(nik: string): Promise<HrisEmployee | null>`, `getEmployeesPage(page: number): Promise<HrisEmployeesPage | null>`.

- [ ] **Step 1: Tulis failing test**

`apps/backend/src/modules/hris-gateway/hris-gateway.adapter.spec.ts`:

```typescript
import { HrisGatewayAdapter } from './hris-gateway.adapter';

// Mock axios: create() mengembalikan instance palsu yang bisa kita kontrol
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('axios', () => ({
    create: jest.fn(() => ({ get: mockGet, post: mockPost })),
}));

describe('HrisGatewayAdapter', () => {
    let adapter: HrisGatewayAdapter;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.HRIS_GATEWAY_BASE_URL = 'http://10.10.6.51:27080/api/v1';
        process.env.HRIS_GATEWAY_API_KEY = 'test-key';
        adapter = new HrisGatewayAdapter();
    });

    it('isConfigured true saat env lengkap', () => {
        expect(adapter.isConfigured()).toBe(true);
    });

    it('verifyPassword mengembalikan hasil Gateway', async () => {
        mockPost.mockResolvedValue({ data: { valid: true, eligible: true, match: false } });
        const r = await adapter.verifyPassword('00000024', 'x');
        expect(mockPost).toHaveBeenCalledWith('/auth/verify', { nik: '00000024', password: 'x' });
        expect(r).toEqual({ valid: true, eligible: true, match: false });
    });

    it('verifyPassword mengembalikan null saat Gateway error (bukan throw)', async () => {
        mockPost.mockRejectedValue(new Error('ECONNREFUSED'));
        await expect(adapter.verifyPassword('1', 'x')).resolves.toBeNull();
    });

    it('getEmployee retry lalu sukses', async () => {
        mockGet
            .mockRejectedValueOnce(new Error('socket hang up'))
            .mockResolvedValueOnce({ data: { nik_hris: '00000024', nama_karyawan: 'TEST' } });
        const r = await adapter.getEmployee('00000024');
        expect(mockGet).toHaveBeenCalledTimes(2);
        expect(r?.nik_hris).toBe('00000024');
    });

    it('getEmployee null setelah retry habis', async () => {
        mockGet.mockRejectedValue(new Error('timeout'));
        await expect(adapter.getEmployee('1')).resolves.toBeNull();
        expect(mockGet).toHaveBeenCalledTimes(3);
    });

    it('getEmployeesPage memanggil ?page=N', async () => {
        mockGet.mockResolvedValue({ data: { data: [], total: 4736 } });
        const r = await adapter.getEmployeesPage(2);
        expect(mockGet).toHaveBeenCalledWith('/employees?page=2');
        expect(r?.total).toBe(4736);
    });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/backend && npx jest hris-gateway.adapter --runInBand`
Expected: FAIL — `Cannot find module './hris-gateway.adapter'`

- [ ] **Step 3: Implementasi adapter**

`apps/backend/src/modules/hris-gateway/hris-gateway.adapter.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface HrisEmployee {
    nik_hris: string;
    nik_santos: string | null;
    nama_karyawan: string;
    id_departemen: string | null;
    nama_departemen: string | null;
    nama_jabatan: string | null;
    email: string | null;
    lokasi: string | null;
    tgl_keluar: string | null;
}

export interface HrisVerifyResult {
    valid: boolean;
    eligible: boolean;
    match: boolean;
}

export interface HrisEmployeesPage {
    data: HrisEmployee[];
    total: number;
}

const REQUEST_TIMEOUT_MS = 10000;
const GET_RETRIES = 3; // Gateway teramati kadang drop koneksi (HTTP 000)

@Injectable()
export class HrisGatewayAdapter {
    private readonly logger = new Logger(HrisGatewayAdapter.name);
    private readonly http: AxiosInstance;

    constructor() {
        this.http = axios.create({
            baseURL: process.env.HRIS_GATEWAY_BASE_URL,
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
                'X-API-Key': process.env.HRIS_GATEWAY_API_KEY || '',
                'Content-Type': 'application/json',
            },
        });
    }

    isConfigured(): boolean {
        return !!(process.env.HRIS_GATEWAY_BASE_URL && process.env.HRIS_GATEWAY_API_KEY);
    }

    async ping(): Promise<boolean> {
        try {
            const res = await this.http.get('/ping');
            return res.data?.ok === true;
        } catch {
            return false;
        }
    }

    /**
     * null = Gateway tidak bisa dihubungi / error — caller wajib fallback lokal.
     * Password salah BUKAN null, melainkan { match: false }.
     */
    async verifyPassword(nik: string, password: string): Promise<HrisVerifyResult | null> {
        try {
            const res = await this.http.post('/auth/verify', { nik, password });
            return res.data;
        } catch (error: any) {
            this.logger.warn(`Gateway verify unreachable for NIK ${nik}: ${error.message}`);
            return null;
        }
    }

    async getEmployee(nik: string): Promise<HrisEmployee | null> {
        const data = await this.getWithRetry<HrisEmployee>(`/employees/${encodeURIComponent(nik)}`);
        return data && data.nik_hris ? data : null;
    }

    async getEmployeesPage(page: number): Promise<HrisEmployeesPage | null> {
        return this.getWithRetry<HrisEmployeesPage>(`/employees?page=${page}`);
    }

    private async getWithRetry<T>(url: string): Promise<T | null> {
        for (let attempt = 1; attempt <= GET_RETRIES; attempt++) {
            try {
                const res = await this.http.get(url);
                return res.data as T;
            } catch (error: any) {
                this.logger.warn(`GET ${url} attempt ${attempt}/${GET_RETRIES} failed: ${error.message}`);
                if (attempt === GET_RETRIES) return null;
            }
        }
        return null;
    }
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `cd apps/backend && npx jest hris-gateway.adapter --runInBand`
Expected: PASS (6 tests)

- [ ] **Step 5: Tambah env examples**

Append ke `apps/backend/.env.example` DAN `.env.example` (root):

```
# ===========================================
# HRIS API Gateway (login NIK karyawan)
# ===========================================
HRIS_GATEWAY_BASE_URL=http://10.10.6.51:27080/api/v1
HRIS_GATEWAY_API_KEY=your-hris-gateway-api-key
```

Lalu tambahkan key ASLI ke `apps/backend/.env` lokal (TIDAK di-commit; `.env` sudah di .gitignore — verifikasi dengan `git check-ignore apps/backend/.env`, expected: path tercetak).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/hris-gateway/hris-gateway.adapter.ts apps/backend/src/modules/hris-gateway/hris-gateway.adapter.spec.ts apps/backend/.env.example .env.example
git commit -m "feat(hris): add HRIS gateway HTTP adapter with retry + env config"
```

---

### Task 3: Sync service + cron + admin endpoint + module

**Files:**
- Create: `apps/backend/src/modules/hris-gateway/hris-sync.service.ts`
- Create: `apps/backend/src/modules/hris-gateway/hris-sync.controller.ts`
- Create: `apps/backend/src/modules/hris-gateway/hris-gateway.module.ts`
- Modify: `apps/backend/src/app.module.ts` (register module)
- Test: `apps/backend/src/modules/hris-gateway/hris-sync.service.spec.ts`

**Interfaces:**
- Consumes: `HrisGatewayAdapter` (Task 2), mapping (Task 1), repos `User`/`Site`/`Department`.
- Produces (dipakai Task 4):
  - `class HrisSyncService`: `provisionEmployee(emp: HrisEmployee): Promise<User>` (create user baru dari data HRIS — dipakai JIT login), `syncAll(): Promise<HrisSyncSummary>`.
  - `interface HrisSyncSummary { created: number; updated: number; skipped: number; errors: string[]; }`
  - `HrisGatewayModule` meng-export `HrisGatewayAdapter` dan `HrisSyncService`.
- Endpoint: `POST /hris-sync/run` (JwtAuthGuard + RolesGuard, `@Roles(UserRole.ADMIN)`).

- [ ] **Step 1: Tulis failing test**

`apps/backend/src/modules/hris-gateway/hris-sync.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HrisSyncService } from './hris-sync.service';
import { HrisGatewayAdapter, HrisEmployee } from './hris-gateway.adapter';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { Department } from '../users/entities/department.entity';
import { UserRole } from '../users/enums/user-role.enum';

const emp = (over: Partial<HrisEmployee> = {}): HrisEmployee => ({
    nik_hris: '00000024',
    nik_santos: '2130406',
    nama_karyawan: 'CHRISTHIN M G',
    id_departemen: '2.0034',
    nama_departemen: 'PROCUREMENT',
    nama_jabatan: 'GM',
    email: 'c@kapalapi.co.id',
    lokasi: 'SJA-1',
    tgl_keluar: null,
    ...over,
});

describe('HrisSyncService', () => {
    let service: HrisSyncService;
    let userRepo: any;
    let siteRepo: any;
    let deptRepo: any;
    let gateway: any;

    beforeEach(async () => {
        userRepo = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((x) => x),
            save: jest.fn(async (x) => ({ id: 'u1', ...x })),
        };
        siteRepo = { find: jest.fn().mockResolvedValue([{ id: 'site-spj', code: 'SPJ' }, { id: 'site-krw', code: 'KRW' }]) };
        deptRepo = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((x) => x),
            save: jest.fn(async (x) => ({ id: 'dept-1', ...x })),
        };
        gateway = { getEmployeesPage: jest.fn(), getEmployee: jest.fn(), isConfigured: jest.fn().mockReturnValue(true) };

        const mod = await Test.createTestingModule({
            providers: [
                HrisSyncService,
                { provide: HrisGatewayAdapter, useValue: gateway },
                { provide: getRepositoryToken(User), useValue: userRepo },
                { provide: getRepositoryToken(Site), useValue: siteRepo },
                { provide: getRepositoryToken(Department), useValue: deptRepo },
            ],
        }).compile();
        service = mod.get(HrisSyncService);
    });

    describe('provisionEmployee', () => {
        it('membuat user USER dengan site SPJ, dept find-or-create, password bcrypt 123456', async () => {
            const user = await service.provisionEmployee(emp());
            const saved = userRepo.save.mock.calls[0][0];
            expect(saved.employeeId).toBe('00000024');
            expect(saved.fullName).toBe('CHRISTHIN M G');
            expect(saved.role).toBe(UserRole.USER);
            expect(saved.siteId).toBe('site-spj');
            expect(saved.email).toBe('c@kapalapi.co.id');
            expect(saved.password).toMatch(/^\$2[aby]\$/); // bcrypt hash, bukan plaintext
            expect(saved.password).not.toBe('123456');
            expect(user.id).toBe('u1');
        });

        it('departemen SNI AREA -> AGENT_OPERATIONAL_SUPPORT', async () => {
            await service.provisionEmployee(emp({ nama_departemen: 'SECURITY & NETWORK INFRASTURCTURE AREA - SEPANJANG' }));
            expect(userRepo.save.mock.calls[0][0].role).toBe(UserRole.AGENT_OPERATIONAL_SUPPORT);
        });

        it('ISD -> AGENT_ORACLE', async () => {
            await service.provisionEmployee(emp({ nama_departemen: 'INFORMATION SYSTEM DEVELOPMENT' }));
            expect(userRepo.save.mock.calls[0][0].role).toBe(UserRole.AGENT_ORACLE);
        });

        it('email kosong -> fallback {nik}@hris.local', async () => {
            await service.provisionEmployee(emp({ email: null }));
            expect(userRepo.save.mock.calls[0][0].email).toBe('00000024@hris.local');
        });

        it('email sudah dipakai user lain -> fallback {nik}@hris.local', async () => {
            // findOne pertama: cek email existing -> ada milik employeeId lain
            userRepo.findOne.mockImplementation(async ({ where }: any) =>
                where.email ? { id: 'other', employeeId: 'X' } : null,
            );
            await service.provisionEmployee(emp());
            expect(userRepo.save.mock.calls[0][0].email).toBe('00000024@hris.local');
        });
    });

    describe('syncAll', () => {
        it('create baru, update existing (tanpa sentuh password/role/email), skip tgl_keluar', async () => {
            const existing = {
                id: 'u-old', employeeId: '00000043', fullName: 'LAMA', role: UserRole.ADMIN,
                email: 'lama@x.com', password: 'HASH-LAMA', isActive: true,
            };
            userRepo.findOne.mockImplementation(async ({ where }: any) => {
                if (where.employeeId === '00000043') return existing;
                return null;
            });
            gateway.getEmployeesPage.mockResolvedValueOnce({
                total: 3,
                data: [
                    emp(), // baru -> created
                    emp({ nik_hris: '00000043', nama_karyawan: 'BARU NAMA', lokasi: 'SJA-2' }), // existing -> updated
                    emp({ nik_hris: '00000099', tgl_keluar: '2025-01-01T00:00:00.000Z' }), // resigned -> skipped
                ],
            });

            const summary = await service.syncAll();

            expect(summary).toMatchObject({ created: 1, updated: 1, skipped: 1 });
            expect(summary.errors).toHaveLength(0);
            // update: hanya fullName/jobTitle/departmentId/siteId
            const updateSave = userRepo.save.mock.calls.find((c: any[]) => c[0].id === 'u-old')[0];
            expect(updateSave.fullName).toBe('BARU NAMA');
            expect(updateSave.siteId).toBe('site-krw');
            expect(updateSave.role).toBe(UserRole.ADMIN);      // TIDAK berubah
            expect(updateSave.password).toBe('HASH-LAMA');     // TIDAK berubah
            expect(updateSave.email).toBe('lama@x.com');       // TIDAK berubah
        });

        it('halaman gagal fetch -> catat error, tidak throw', async () => {
            gateway.getEmployeesPage.mockResolvedValue(null);
            const summary = await service.syncAll();
            expect(summary.errors.length).toBeGreaterThan(0);
        });
    });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/backend && npx jest hris-sync.service --runInBand`
Expected: FAIL — `Cannot find module './hris-sync.service'`

- [ ] **Step 3: Implementasi sync service**

`apps/backend/src/modules/hris-gateway/hris-sync.service.ts`:

```typescript
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { Department } from '../users/entities/department.entity';
import { BCRYPT_ROUNDS } from '../../shared/core/config/security.config';
import { HrisGatewayAdapter, HrisEmployee } from './hris-gateway.adapter';
import { DEFAULT_HRIS_PASSWORD, resolveRole, resolveSiteCode } from './hris-mapping';

export interface HrisSyncSummary {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
}

const PAGE_SIZE = 50; // ukuran halaman tetap Gateway (limit/offset tidak didukung)
const MAX_PAGES = 500; // pengaman loop; 4736 karyawan = 95 halaman

@Injectable()
export class HrisSyncService {
    private readonly logger = new Logger(HrisSyncService.name);
    private syncRunning = false;

    constructor(
        private readonly gateway: HrisGatewayAdapter,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(Site) private readonly siteRepo: Repository<Site>,
        @InjectRepository(Department) private readonly departmentRepo: Repository<Department>,
    ) {}

    @Cron('0 2 * * *') // 02:00 WIB harian
    async scheduledSync() {
        if (!this.gateway.isConfigured()) return;
        this.logger.log('Scheduled HRIS sync starting');
        const summary = await this.syncAll().catch((e) => {
            this.logger.error(`Scheduled HRIS sync failed: ${e.message}`);
            return null;
        });
        if (summary) {
            this.logger.log(`HRIS sync done: ${JSON.stringify({ ...summary, errors: summary.errors.length })}`);
        }
    }

    async syncAll(): Promise<HrisSyncSummary> {
        if (this.syncRunning) {
            throw new ConflictException('HRIS sync is already running');
        }
        this.syncRunning = true;
        try {
            const summary: HrisSyncSummary = { created: 0, updated: 0, skipped: 0, errors: [] };
            const siteByCode = await this.loadSiteMap();

            let fetched = 0;
            let total = Number.MAX_SAFE_INTEGER;
            for (let page = 1; page <= MAX_PAGES && fetched < total; page++) {
                const res = await this.gateway.getEmployeesPage(page);
                if (!res || !Array.isArray(res.data)) {
                    summary.errors.push(`page ${page}: fetch failed`);
                    break;
                }
                total = res.total;
                fetched += res.data.length;
                if (res.data.length === 0) break;

                for (const emp of res.data) {
                    try {
                        const result = await this.upsertEmployee(emp, siteByCode);
                        summary[result]++;
                    } catch (e: any) {
                        summary.errors.push(`${emp.nik_hris}: ${e.message}`);
                    }
                }
            }
            return summary;
        } finally {
            this.syncRunning = false;
        }
    }

    /** JIT provisioning saat login NIK pertama (dipanggil AuthService). */
    async provisionEmployee(emp: HrisEmployee): Promise<User> {
        const siteByCode = await this.loadSiteMap();
        const siteId = this.resolveSiteId(emp.lokasi, siteByCode);
        const departmentId = await this.findOrCreateDepartment(emp.nama_departemen, siteId);
        const email = await this.resolveUniqueEmail(emp);

        const user = this.userRepo.create({
            email,
            fullName: emp.nama_karyawan,
            employeeId: emp.nik_hris,
            role: resolveRole(emp.nama_departemen),
            siteId: siteId ?? undefined,
            departmentId: departmentId ?? undefined,
            jobTitle: emp.nama_jabatan ?? undefined,
            password: await bcrypt.hash(DEFAULT_HRIS_PASSWORD, BCRYPT_ROUNDS),
            isActive: true,
        });
        return this.userRepo.save(user);
    }

    private async upsertEmployee(
        emp: HrisEmployee,
        siteByCode: Map<string, Site>,
    ): Promise<'created' | 'updated' | 'skipped'> {
        if (!emp.nik_hris || emp.tgl_keluar) return 'skipped';

        const existing = await this.userRepo.findOne({ where: { employeeId: emp.nik_hris } });
        if (existing) {
            // Refresh data organisasi saja — JANGAN sentuh password/role/email/isActive
            existing.fullName = emp.nama_karyawan;
            existing.jobTitle = emp.nama_jabatan ?? existing.jobTitle;
            existing.siteId = this.resolveSiteId(emp.lokasi, siteByCode) ?? existing.siteId;
            const deptId = await this.findOrCreateDepartment(emp.nama_departemen, existing.siteId);
            existing.departmentId = deptId ?? existing.departmentId;
            await this.userRepo.save(existing);
            return 'updated';
        }

        const siteId = this.resolveSiteId(emp.lokasi, siteByCode);
        const departmentId = await this.findOrCreateDepartment(emp.nama_departemen, siteId);
        const email = await this.resolveUniqueEmail(emp);
        const user = this.userRepo.create({
            email,
            fullName: emp.nama_karyawan,
            employeeId: emp.nik_hris,
            role: resolveRole(emp.nama_departemen),
            siteId: siteId ?? undefined,
            departmentId: departmentId ?? undefined,
            jobTitle: emp.nama_jabatan ?? undefined,
            password: await bcrypt.hash(DEFAULT_HRIS_PASSWORD, BCRYPT_ROUNDS),
            isActive: true,
        });
        await this.userRepo.save(user);
        return 'created';
    }

    private async loadSiteMap(): Promise<Map<string, Site>> {
        const sites = await this.siteRepo.find();
        return new Map(sites.map((s) => [s.code.toUpperCase(), s]));
    }

    private resolveSiteId(lokasi: string | null | undefined, siteByCode: Map<string, Site>): string | null {
        const code = resolveSiteCode(lokasi);
        if (!code) return null;
        return siteByCode.get(code)?.id ?? null;
    }

    private async findOrCreateDepartment(nama: string | null | undefined, siteId: string | null): Promise<string | null> {
        const name = (nama || '').trim();
        if (!name) return null;
        const code = name.toUpperCase();
        let dept = await this.departmentRepo.findOne({ where: { code } });
        if (!dept) {
            dept = await this.departmentRepo.save(
                this.departmentRepo.create({ name, code, siteId: siteId ?? undefined }),
            );
        }
        return dept.id;
    }

    private async resolveUniqueEmail(emp: HrisEmployee): Promise<string> {
        const fallback = `${emp.nik_hris}@hris.local`;
        const email = (emp.email || '').trim().toLowerCase();
        if (!email) return fallback;
        const taken = await this.userRepo.findOne({
            where: { email, employeeId: Not(emp.nik_hris) },
        });
        return taken ? fallback : email;
    }
}
```

Catatan implementer: test mock `userRepo.findOne` menerima objek `where` — mock di spec sudah kompatibel dengan bentuk `{ where: { email, employeeId: Not(...) } }` karena hanya membaca `where.email` / `where.employeeId`.

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `cd apps/backend && npx jest hris-sync.service --runInBand`
Expected: PASS (7 tests)

- [ ] **Step 5: Controller + module + registrasi app**

`apps/backend/src/modules/hris-gateway/hris-sync.controller.ts`:

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { HrisSyncService } from './hris-sync.service';

@ApiTags('HRIS Sync')
@ApiBearerAuth()
@Controller('hris-sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HrisSyncController {
    constructor(private readonly hrisSyncService: HrisSyncService) {}

    @Post('run')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Sync semua karyawan HRIS ke iDesk (admin only)' })
    async run() {
        return this.hrisSyncService.syncAll();
    }
}
```

`apps/backend/src/modules/hris-gateway/hris-gateway.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { Department } from '../users/entities/department.entity';
import { HrisGatewayAdapter } from './hris-gateway.adapter';
import { HrisSyncService } from './hris-sync.service';
import { HrisSyncController } from './hris-sync.controller';

@Module({
    imports: [TypeOrmModule.forFeature([User, Site, Department])],
    providers: [HrisGatewayAdapter, HrisSyncService],
    controllers: [HrisSyncController],
    exports: [HrisGatewayAdapter, HrisSyncService],
})
export class HrisGatewayModule {}
```

Modify `apps/backend/src/app.module.ts` — tambah import (ikuti daftar module existing di file itu):

```typescript
import { HrisGatewayModule } from './modules/hris-gateway/hris-gateway.module';
```

dan tambahkan `HrisGatewayModule,` ke array `imports: [...]` module utama.

- [ ] **Step 6: Build check**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0, tanpa error TS. (Kalau proyek punya error pre-existing, pastikan tidak ada error BARU di file hris-gateway/*.)

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/hris-gateway/ apps/backend/src/app.module.ts
git commit -m "feat(hris): add employee sync service, daily cron, and admin sync endpoint"
```

---

### Task 4: Cabang login NIK di AuthService

**Files:**
- Modify: `apps/backend/src/modules/users/user-crud.service.ts` (tambah `findByEmployeeId`, dekat `findByEmail` ~line 236)
- Modify: `apps/backend/src/modules/users/users.service.ts` (delegasi, dekat `findByEmail` ~line 72)
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts` (cabang NIK di `validateUserWithDetails`, ~line 58)
- Modify: `apps/backend/src/modules/auth/auth.module.ts` (import `HrisGatewayModule`)
- Modify: `apps/backend/src/modules/auth/application/auth.service.spec.ts` (tambah 2 mock provider agar tetap compile)
- Test: `apps/backend/src/modules/auth/application/auth.service.hris.spec.ts` (file baru)

**Interfaces:**
- Consumes: `HrisGatewayAdapter.verifyPassword/getEmployee`, `HrisSyncService.provisionEmployee` (Task 2 & 3), `UsersService.findByEmployeeId` (dibuat di task ini).
- Produces: `UsersService.findByEmployeeId(employeeId: string): Promise<User | undefined>`; `validateUserWithDetails(identifier, pass)` kini menerima NIK ATAU email pada parameter pertama (nama parameter diganti `identifier`). `LocalStrategy` TIDAK berubah.

- [ ] **Step 1: Tambah findByEmployeeId**

Di `user-crud.service.ts`, setelah method `findByEmail` (line ~239):

```typescript
    async findByEmployeeId(employeeId: string): Promise<User | undefined> {
        const user = await this.userRepo.findOne({ where: { employeeId } });
        return user || undefined;
    }
```

Di `users.service.ts`, setelah `findByEmail` (line ~74):

```typescript
    async findByEmployeeId(employeeId: string): Promise<User | undefined> {
        return this.userCrudService.findByEmployeeId(employeeId);
    }
```

- [ ] **Step 2: Tulis failing test jalur NIK**

`apps/backend/src/modules/auth/application/auth.service.hris.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../../users/users.service';
import { AuditService } from '../../audit/audit.service';
import { HrisGatewayAdapter } from '../../hris-gateway/hris-gateway.adapter';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';

// Path relatif sama persis dengan import di auth.service.ts (satu direktori).

describe('AuthService — jalur login NIK HRIS', () => {
    let service: AuthService;
    let usersService: any;
    let gateway: any;
    let hrisSync: any;

    const localUser = async (over: any = {}) => ({
        id: 'u1',
        email: '00000024@hris.local',
        employeeId: '00000024',
        fullName: 'TEST',
        role: 'USER',
        isActive: true,
        password: await bcrypt.hash('123456', 4),
        ...over,
    });

    beforeEach(async () => {
        usersService = {
            findByEmail: jest.fn(),
            findByEmployeeId: jest.fn(),
            update: jest.fn(),
            setCurrentRefreshToken: jest.fn(),
        };
        gateway = { verifyPassword: jest.fn(), getEmployee: jest.fn() };
        hrisSync = { provisionEmployee: jest.fn() };

        const mod = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: JwtService, useValue: { sign: jest.fn(() => 'tok'), verify: jest.fn() } },
                { provide: UsersService, useValue: usersService },
                { provide: AuditService, useValue: { logAsync: jest.fn() } },
                { provide: HrisGatewayAdapter, useValue: gateway },
                { provide: HrisSyncService, useValue: hrisSync },
            ],
        }).compile();
        service = mod.get(AuthService);
    });

    it('identifier ber-@ tetap jalur email lama', async () => {
        usersService.findByEmail.mockResolvedValue(undefined);
        const r = await service.validateUserWithDetails('a@b.com', 'x');
        expect(r.errorCode).toBe('USER_NOT_FOUND');
        expect(gateway.verifyPassword).not.toHaveBeenCalled();
    });

    it('NIK + match:true + user existing -> sukses', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: true });
        usersService.findByEmployeeId.mockResolvedValue(await localUser());
        const r = await service.validateUserWithDetails('00000024', 'passwordHris');
        expect(r.success).toBe(true);
        expect(r.user.password).toBeUndefined();
    });

    it('NIK valid:false -> USER_NOT_FOUND', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: false, eligible: false, match: false });
        const r = await service.validateUserWithDetails('99999999', 'x');
        expect(r).toMatchObject({ success: false, errorCode: 'USER_NOT_FOUND' });
    });

    it('NIK eligible:false -> ACCOUNT_DISABLED', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: false, match: false });
        const r = await service.validateUserWithDetails('00000024', 'x');
        expect(r).toMatchObject({ success: false, errorCode: 'ACCOUNT_DISABLED' });
    });

    it('match:false + password lokal benar (123456) -> sukses (fallback)', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: false });
        usersService.findByEmployeeId.mockResolvedValue(await localUser());
        const r = await service.validateUserWithDetails('00000024', '123456');
        expect(r.success).toBe(true);
    });

    it('match:false + password lokal salah -> WRONG_PASSWORD', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: false });
        usersService.findByEmployeeId.mockResolvedValue(await localUser());
        const r = await service.validateUserWithDetails('00000024', 'salah');
        expect(r).toMatchObject({ success: false, errorCode: 'WRONG_PASSWORD' });
    });

    it('Gateway down (null) + password lokal benar -> sukses', async () => {
        gateway.verifyPassword.mockResolvedValue(null);
        usersService.findByEmployeeId.mockResolvedValue(await localUser());
        const r = await service.validateUserWithDetails('00000024', '123456');
        expect(r.success).toBe(true);
    });

    it('match:true + user belum ada -> JIT provision', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: true });
        usersService.findByEmployeeId.mockResolvedValue(undefined);
        gateway.getEmployee.mockResolvedValue({ nik_hris: '00000024', nama_karyawan: 'BARU' });
        hrisSync.provisionEmployee.mockResolvedValue(await localUser({ fullName: 'BARU' }));
        const r = await service.validateUserWithDetails('00000024', 'passwordHris');
        expect(hrisSync.provisionEmployee).toHaveBeenCalled();
        expect(r.success).toBe(true);
    });

    it('match:true + user belum ada + getEmployee gagal -> USER_NOT_FOUND', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: true });
        usersService.findByEmployeeId.mockResolvedValue(undefined);
        gateway.getEmployee.mockResolvedValue(null);
        const r = await service.validateUserWithDetails('00000024', 'x');
        expect(r).toMatchObject({ success: false, errorCode: 'USER_NOT_FOUND' });
    });

    it('Gateway down + user belum ada + password 123456 + getEmployee sukses -> JIT provision', async () => {
        gateway.verifyPassword.mockResolvedValue(null);
        usersService.findByEmployeeId.mockResolvedValue(undefined);
        gateway.getEmployee.mockResolvedValue({ nik_hris: '00000024', nama_karyawan: 'BARU' });
        hrisSync.provisionEmployee.mockResolvedValue(await localUser());
        const r = await service.validateUserWithDetails('00000024', '123456');
        expect(r.success).toBe(true);
    });

    it('user existing isActive:false -> ACCOUNT_DISABLED', async () => {
        gateway.verifyPassword.mockResolvedValue({ valid: true, eligible: true, match: true });
        usersService.findByEmployeeId.mockResolvedValue(await localUser({ isActive: false }));
        const r = await service.validateUserWithDetails('00000024', 'x');
        expect(r).toMatchObject({ success: false, errorCode: 'ACCOUNT_DISABLED' });
    });
});
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run: `cd apps/backend && npx jest auth.service.hris --runInBand`
Expected: FAIL — constructor AuthService belum menerima HrisGatewayAdapter/HrisSyncService (dependency resolution error atau `gateway.verifyPassword` tak terpanggil).

- [ ] **Step 4: Implementasi cabang NIK**

Di `auth.service.ts`:

(a) Tambah import di atas:

```typescript
import { HrisGatewayAdapter } from '../../hris-gateway/hris-gateway.adapter';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';
import { DEFAULT_HRIS_PASSWORD } from '../../hris-gateway/hris-mapping';
```

(b) Tambah 2 parameter constructor:

```typescript
    constructor(
        private jwtService: JwtService,
        private usersService: UsersService,
        private auditService: AuditService,
        private hrisGateway: HrisGatewayAdapter,
        private hrisSync: HrisSyncService,
    ) { }
```

(c) Ubah `validateUserWithDetails` — rename parameter `email` → `identifier`, tambahkan dispatch di baris pertama (body existing jalur email TIDAK diubah, hanya variabel `email` di dalamnya membaca `identifier`):

```typescript
    async validateUserWithDetails(identifier: string, pass: string, request?: Request): Promise<LoginValidationResult> {
        if (!identifier.includes('@')) {
            return this.validateNikLogin(identifier.trim(), pass, request);
        }
        const email = identifier;
        // ... sisa body existing persis seperti semula ...
```

(d) Tambah method privat baru setelah `validateUserWithDetails`:

```typescript
    /**
     * Jalur login NIK HRIS (spec docs/superpowers/specs/2026-07-20-hris-gateway-login-design.md).
     * Urutan: verify Gateway -> fallback password lokal/default -> find-or-create by employeeId.
     */
    private async validateNikLogin(nik: string, pass: string, request?: Request): Promise<LoginValidationResult> {
        const verify = await this.hrisGateway.verifyPassword(nik, pass);

        if (verify) {
            if (!verify.valid) {
                this.auditService.logAsync({
                    userId: 'system',
                    action: AuditAction.LOGIN_FAILED,
                    entityType: 'auth',
                    description: `Login failed: NIK ${nik} not found in HRIS`,
                    newValue: { nik, reason: 'USER_NOT_FOUND' },
                    request,
                });
                return { success: false, errorCode: 'USER_NOT_FOUND' };
            }
            if (!verify.eligible) {
                this.auditService.logAsync({
                    userId: 'system',
                    action: AuditAction.LOGIN_FAILED,
                    entityType: 'auth',
                    description: `Login failed: NIK ${nik} not eligible (inactive employee)`,
                    newValue: { nik, reason: 'ACCOUNT_DISABLED' },
                    request,
                });
                return { success: false, errorCode: 'ACCOUNT_DISABLED' };
            }
        }

        const localUser = await this.usersService.findByEmployeeId(nik);

        // Autentikasi: match Gateway ATAU fallback password lokal / default 123456
        let authenticated = verify?.match === true;
        if (!authenticated) {
            if (localUser) {
                authenticated = await bcrypt.compare(pass, localUser.password || '');
            } else {
                // user belum ada lokal: hanya default password yang diterima
                authenticated = pass === DEFAULT_HRIS_PASSWORD;
            }
        }
        if (!authenticated) {
            this.auditService.logAsync({
                userId: localUser?.id || 'system',
                action: AuditAction.LOGIN_FAILED,
                entityType: 'auth',
                entityId: localUser?.id,
                description: `Login failed: wrong password for NIK ${nik}`,
                newValue: { nik, reason: 'WRONG_PASSWORD' },
                request,
            });
            return { success: false, errorCode: 'WRONG_PASSWORD' };
        }

        // Find-or-create (JIT provisioning)
        let user = localUser;
        if (!user) {
            const emp = await this.hrisGateway.getEmployee(nik);
            if (!emp) {
                // Gateway tak bisa kasih data profil -> tidak bisa create; tunggu cron sync
                return { success: false, errorCode: 'USER_NOT_FOUND' };
            }
            user = await this.hrisSync.provisionEmployee(emp);
        }

        if (user.isActive === false) {
            this.auditService.logAsync({
                userId: user.id,
                action: AuditAction.LOGIN_FAILED,
                entityType: 'auth',
                entityId: user.id,
                description: `Login failed: account disabled for ${user.fullName}`,
                newValue: { nik, reason: 'ACCOUNT_DISABLED' },
                request,
            });
            return { success: false, errorCode: 'ACCOUNT_DISABLED' };
        }

        const { password, ...result } = user as any;
        return { success: true, user: result };
    }
```

(e) Di `auth.module.ts`: tambah `import { HrisGatewayModule } from '../hris-gateway/hris-gateway.module';` dan `HrisGatewayModule,` ke array `imports`.

(f) Di `auth.service.spec.ts` existing: tambahkan ke array `providers` Test module:

```typescript
                { provide: HrisGatewayAdapter, useValue: { verifyPassword: jest.fn(), getEmployee: jest.fn() } },
                { provide: HrisSyncService, useValue: { provisionEmployee: jest.fn() } },
```

dengan import:

```typescript
import { HrisGatewayAdapter } from '../../hris-gateway/hris-gateway.adapter';
import { HrisSyncService } from '../../hris-gateway/hris-sync.service';
```

- [ ] **Step 5: Jalankan semua test auth, pastikan lolos**

Run: `cd apps/backend && npx jest "auth.service" --runInBand`
Expected: PASS — file spec baru (12 tests) DAN spec lama (regression jalur email).

- [ ] **Step 6: Build check**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: tanpa error baru.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/auth/ apps/backend/src/modules/users/user-crud.service.ts apps/backend/src/modules/users/users.service.ts
git commit -m "feat(auth): add NIK HRIS login path with gateway verify and JIT provisioning"
```

---

### Task 5: Akses operasional untuk role Agent baru

**Files:**
- Modify: `apps/backend/src/modules/users/users.controller.ts:103-119`
- Modify: `apps/backend/src/modules/users/user-crud.service.ts:241-260`
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx:84-90`
- Modify: `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx:43-45,253`
- Modify: `apps/frontend/src/components/layout/BentoSidebar.tsx:203`
- Test: `apps/backend/src/modules/users/user-crud.service.hris.spec.ts` (file baru; unit test `getAgents` query builder)

**Interfaces:**
- Consumes: `UserRole` enum existing.
- Produces:
  - `OPERATIONAL_AGENT_ROLES = [UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT]` di `users.controller.ts` dan `user-crud.service.ts` (file-local karena hanya dua consumer, tidak ada abstraction baru).
  - `AGENT_ORACLE` redirect ke `/dashboard`, tetapi tidak lolos endpoint `/users/agents` dan `/users/agents/stats`.
  - Halaman Admin Agents menampilkan `AGENT_OPERATIONAL_SUPPORT` di kelompok operasional dan `AGENT_ORACLE` di kelompok Oracle, bukan kelompok legacy `AGENT`.

- [ ] **Step 1: Tulis test role query getAgents**

Buat `apps/backend/src/modules/users/user-crud.service.hris.spec.ts`:

```typescript
import { UserCrudService } from './user-crud.service';
import { UserRole } from './enums/user-role.enum';

describe('UserCrudService.getAgents — role HRIS', () => {
    it('memasukkan legacy AGENT dan AGENT_OPERATIONAL_SUPPORT, bukan AGENT_ORACLE', async () => {
        const qb = {
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
        };
        const userRepo = { createQueryBuilder: jest.fn(() => qb) };
        const service = new UserCrudService(
            userRepo as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
        );

        await service.getAgents();

        expect(qb.andWhere).toHaveBeenCalledWith('user.role IN (:...roles)', {
            roles: [UserRole.AGENT, UserRole.ADMIN, UserRole.AGENT_OPERATIONAL_SUPPORT],
        });
    });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/backend && npx jest user-crud.service.hris --runInBand`
Expected: FAIL karena query existing hanya berisi `AGENT` dan `ADMIN`.

- [ ] **Step 3: Ubah backend role access minimum**

Di `apps/backend/src/modules/users/user-crud.service.ts`, dekat import/top-level constants:

```typescript
const OPERATIONAL_AGENT_ROLES = [
    UserRole.AGENT,
    UserRole.ADMIN,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
];
```

Di `getAgents`, ganti array literal pada `roles`:

```typescript
roles: OPERATIONAL_AGENT_ROLES,
```

Di `apps/backend/src/modules/users/users.controller.ts`, endpoint `GET /users/agents` dan `GET /users/agents/stats`, ganti decorator masing-masing menjadi:

```typescript
@Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT)
```

JANGAN tambahkan `AGENT_ORACLE`: endpoint ini menampilkan/menangani agent operasional, sedangkan Oracle sudah punya halaman dan guard spesifik `AGENT_ORACLE`.

- [ ] **Step 4: Ubah redirect + display group frontend**

Di `BentoLoginPage.tsx`, buat konstanta file-local sebelum component:

```typescript
const DASHBOARD_ROLES = new Set(['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE']);
```

Ganti kondisi redirect:

```typescript
if (DASHBOARD_ROLES.has(user.role)) {
    navigate('/dashboard');
} else if (user.role === 'MANAGER') {
```

Di `BentoAdminAgentsPage.tsx`:

```typescript
const isAgentRole = ['AGENT', 'AGENT_OPERATIONAL_SUPPORT'].includes(authUser?.role || '');
```

Pada object pengelompokan user sekitar line 253, pertahankan key/section legacy `AGENT` untuk `u.role === 'AGENT'`, lalu tambahkan key terpisah agar varian baru tampil benar:

```typescript
AGENT_OPERATIONAL_SUPPORT: filteredUsers.filter(u => u.role === 'AGENT_OPERATIONAL_SUPPORT'),
AGENT_ORACLE: filteredUsers.filter(u => u.role === 'AGENT_ORACLE'),
```

Di `BentoSidebar.tsx` line ~203, perluas `isManagerOrAdmin` untuk tampilan menu kerja operasional saja:

```typescript
const isManagerOrAdmin = ['MANAGER', 'ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE'].includes(user?.role || '');
```

JANGAN mass-replace checks `role === 'AGENT'` lain. Audit endpoint/feature satu per satu saat role baru butuh akses nyata; memberi akses luas sekarang melanggar least privilege.

- [ ] **Step 5: Jalankan test dan type check**

Run:

```bash
cd apps/backend && npx jest users.technicians --runInBand
cd ../../apps/frontend && npx tsc --noEmit
```

Expected: PASS dan tanpa error TypeScript baru.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/users/ apps/frontend/src/features/auth/pages/BentoLoginPage.tsx apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx apps/frontend/src/components/layout/BentoSidebar.tsx
git commit -m "feat(auth): grant operational access to HRIS agent roles"
```

---

### Task 6: Frontend — field login "NIK / Email"

**Files:**
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx` (line ~57-61 pesan error, ~188-205 field)
- Modify (bila test gagal karena label): `apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.test.tsx`, `BentoLoginPage.integration.test.tsx`

**Interfaces:**
- Consumes: endpoint `POST /auth/login` payload `{ email, password }` — TIDAK berubah (NIK dikirim di field `email`).
- Produces: user bisa mengetik NIK angka ATAU email di satu field.

- [ ] **Step 1: Ubah field**

Di `BentoLoginPage.tsx`:
- Label (line ~188-190): teks `Email Address` → `NIK / Email`.
- Input (line ~192-205): `type="email"` → `type="text"`, `autoComplete="email"` → `autoComplete="username"`, placeholder → `"NIK atau email"`.
- Validasi submit (line ~57-61): pesan `'Email is required.'` → `'NIK / Email is required.'` dan `'Both email and password are required.'` → `'NIK/Email dan password wajib diisi.'`. JANGAN tambah validasi format email — NIK harus lolos.

- [ ] **Step 2: Jalankan test frontend login**

Run: `cd apps/frontend && npx vitest run src/features/auth --reporter=basic 2>&1 | tail -20`
(Bila proyek pakai jest, ganti: `npx jest src/features/auth`.)
Expected: PASS. Jika FAIL karena string label `Email`, perbarui assertion di kedua file test agar mencari `NIK / Email`, lalu jalankan ulang sampai PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/auth/
git commit -m "feat(login): accept NIK or email in single login field"
```

---

### Task 7: Verifikasi integrasi manual (Gateway live + sync)

**Files:** tidak ada perubahan kode — checklist verifikasi.

- [ ] **Step 1: Pastikan env terisi**

`apps/backend/.env` berisi `HRIS_GATEWAY_BASE_URL=http://10.10.6.51:27080/api/v1` dan `HRIS_GATEWAY_API_KEY=<key asli>`. Start backend: `cd apps/backend && npm run start:dev`.

- [ ] **Step 2: Smoke Gateway dari backend host**

```bash
curl -s -H "X-API-Key: $HRIS_GATEWAY_API_KEY" http://10.10.6.51:27080/api/v1/ping
```
Expected: `{"ok":true,"appName":"iDesk"}`

- [ ] **Step 3: Trigger sync massal (login sebagai ADMIN dulu, ambil cookie)**

Via UI admin ATAU curl dengan cookie access_token + CSRF. Endpoint: `POST /hris-sync/run`.
Expected respon: `{"created":~4700,"updated":0,"skipped":~35,"errors":[...]}` (durasi ±2-5 menit — 95 halaman fetch + 4.7k bcrypt hash; jika HTTP timeout proxy, cek log backend untuk summary).

- [ ] **Step 4: Spot-check hasil**

Query DB (atau halaman admin users):
```sql
SELECT role, COUNT(*) FROM users WHERE "employeeId" IS NOT NULL GROUP BY role;
SELECT s.code, COUNT(*) FROM users u JOIN sites s ON s.id = u."siteId" WHERE u."employeeId" IS NOT NULL GROUP BY s.code;
```
Expected: role `AGENT_OPERATIONAL_SUPPORT` ≈ 14 (SNI), `AGENT_ORACLE` ≈ 8 (ISD), sisanya `USER`; distribusi site ≈ SPJ 2044, KRW 1626, SMG 873, JTB 191.

- [ ] **Step 5: Login manual**

1. Login NIK karyawan riil + password `123456` → sukses, role/site sesuai.
2. Login email admin lama → tetap sukses (regression).
3. Login NIK ngawur `99999999` → "No account found".

- [ ] **Step 6: Commit akhir (jika ada penyesuaian) & merge plan checklist**

```bash
git add -A && git status  # review dulu, jangan commit file .env
git commit -m "chore(hris): integration verification fixes"  # hanya bila ada perubahan
```
