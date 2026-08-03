# Backend Perf Plan 01 — P0 Security & Quick Wins

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate P0 security risks (helmet ordering, body DoS, throttler bypass, plain-text credentials) and ship highest-impact quick wins (getManyAndCount, multer limits, permission cache).

**Architecture:** Surgical patches to existing services. No architectural changes. Each task is independent and reversible via single commit.

**Tech Stack:** NestJS 11, TypeORM 0.3, Bull 4, ioredis 5, class-validator 0.14, express 4 (via @nestjs/platform-express).

**Spec reference:** `docs/superpowers/specs/2026-06-15-backend-perf-audit-design.md` Top-10 Quick Wins + P0 section.

**Excluded from this plan:** All P1/P2 findings. Handled in Plan 02-04.

---

## File Structure

| File | Change Type | Responsibility |
|------|-------------|----------------|
| `apps/backend/src/main.ts` | Modify | Helmet order, body size limit, ValidationPipe forbidNonWhitelisted |
| `apps/backend/src/app.module.ts` | Modify | Throttler limits |
| `apps/backend/src/modules/auth/auth.controller.ts` | Modify | Login/register throttler decorators |
| `apps/backend/src/modules/access-request/access-request.service.ts` | Modify | Encrypt accessCredentials |
| `apps/backend/src/modules/access-request/dto/create-access-request.dto.ts` | Modify | Document encryption |
| `apps/backend/src/shared/core/encryption/credential-cipher.service.ts` | Create | AES-256-GCM helper for credential encryption |
| `apps/backend/src/shared/core/encryption/encryption.module.ts` | Create | Module wrapper |
| `apps/backend/src/modules/ticketing/services/ticket-query.service.ts` | Modify | `getManyAndCount()` in findAllPaginated |
| `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts` | Modify | Extract attachmentInterceptor, add fileSize limit |
| `apps/backend/src/modules/ticketing/presentation/interceptors/attachment-upload.interceptor.ts` | Create | Shared multer config |
| `apps/backend/src/modules/permissions/permission.guard.ts` | Modify | Inject CacheService, check cache first |
| `apps/backend/src/modules/permissions/permissions.service.ts` | Modify | Add `getPermissionCache`/`setPermissionCache` methods |
| `apps/backend/src/modules/notifications/notification-center.service.ts` | Modify | `getActionItems` add LIMIT + cache |
| `apps/backend/src/modules/ticketing/services/ticket-template.service.ts` | Modify | Wrap `find()` in cache |
| `apps/backend/src/modules/hardware-request/services/hardware-catalog.service.ts` | Modify | Wrap catalog list in cache |
| `apps/backend/test/security/helmet-order.e2e-spec.ts` | Create | Helmet header presence on early paths |
| `apps/backend/test/security/body-size.e2e-spec.ts` | Create | Reject > 2MB body |
| `apps/backend/test/security/throttler.e2e-spec.ts` | Create | Login throttled at 5/min |
| `apps/backend/test/unit/encryption/credential-cipher.service.spec.ts` | Create | Round-trip encrypt/decrypt |
| `apps/backend/test/unit/permissions/permission.guard.spec.ts` | Create | Cache hit/miss path |
| `apps/backend/test/unit/ticketing/ticket-query.service.spec.ts` | Create | Verify getManyAndCount called |
| `apps/backend/test/unit/notifications/notification-center.service.spec.ts` | Create | Verify LIMIT applied |

---

## Task 1: Move Helmet to Bootstrap Top

**Files:**
- Modify: `apps/backend/src/main.ts:48-50` (insert), `:136` (remove)

- [ ] **Step 1: Read main.ts current bootstrap order**

Run: `rtk read apps/backend/src/main.ts`
Expected: confirm lines 50-58 are CORS, line 136 is helmet, line 162 is compression.

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/security/helmet-order.e2e-spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Helmet order (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('applies helmet headers on a 404 path (early middleware coverage)', async () => {
    const res = await request(app.getHttpServer()).get('/this-path-does-not-exist');
    // helmet sets x-dns-prefetch-control, x-content-type-options, x-frame-options, etc.
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=helmet-order`
Expected: FAIL — x-content-type-options undefined (helmet not applied to early 404 path).

- [ ] **Step 4: Move helmet() in main.ts**

In `apps/backend/src/main.ts`, DELETE the line at 136:
```typescript
app.use(helmet({...}));
```

And INSERT right after `app.enableCors({...})` block (around line 60, before `app.use(cookieParser())`):
```typescript
  app.use(
    helmet({
      contentSecurityPolicy: false, // API only, no inline scripts
      crossOriginEmbedderPolicy: false,
    }),
  );
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=helmet-order`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/main.ts apps/backend/test/security/helmet-order.e2e-spec.ts
git commit -m "fix(security): move helmet to bootstrap top so headers cover all paths"
```

---

## Task 2: Add Body Size Limits (DoS Protection)

**Files:**
- Modify: `apps/backend/src/main.ts:50-60` (insert after helmet)

- [ ] **Step 1: Write failing test**

Create `apps/backend/test/security/body-size.e2e-spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Body size limit (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('rejects JSON body > 2MB with 413', async () => {
    const huge = { data: 'x'.repeat(3 * 1024 * 1024) }; // 3MB
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(huge)
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(413);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=body-size`
Expected: FAIL — request accepted, payload-parsing error 400 (no limit set).

- [ ] **Step 3: Add body limit middleware**

In `apps/backend/src/main.ts`, INSERT right after the `helmet(...)` block from Task 1:

```typescript
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));
```

Ensure imports at top: `import express from 'express';` (check existing — if `Request, Response, NextFunction` from express already imported, add default to the same import line).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=body-size`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/main.ts apps/backend/test/security/body-size.e2e-spec.ts
git commit -m "fix(security): cap JSON body to 2MB and urlencoded to 1MB"
```

---

## Task 3: Throttle Auth Endpoints

**Files:**
- Modify: `apps/backend/src/app.module.ts:155-160`
- Modify: `apps/backend/src/modules/auth/auth.controller.ts` (login/register handlers)

- [ ] **Step 1: Read current throttler config**

Run: `rtk read apps/backend/src/app.module.ts:155-160`
Expected: `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])`.

- [ ] **Step 2: Write failing test**

Create `apps/backend/test/security/throttler.e2e-spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Auth throttler (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('blocks login after 5 attempts/min', async () => {
    const attempts = Array.from({ length: 6 }, () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'x@y.z', password: 'wrong' })
        .set('Content-Type', 'application/json'),
    );
    const responses = await Promise.all(attempts);
    const last = responses[responses.length - 1];
    expect(last.status).toBe(429);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=throttler`
Expected: FAIL — all 6 return 401 (no per-endpoint throttle).

- [ ] **Step 4: Lower global throttler limit**

In `apps/backend/src/app.module.ts:155-160`, change to:

```typescript
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },      // 10 req/sec global
      { name: 'medium', ttl: 60000, limit: 60 },    // 60 req/min global
    ]),
```

- [ ] **Step 5: Add per-endpoint throttle on auth**

In `apps/backend/src/modules/auth/auth.controller.ts`, find the `@Post('login')` handler and add above it:

```typescript
  @Throttle({ medium: { limit: 5, ttl: 60000 } }) // 5/min for login
  @Post('login')
  // ... existing handler
```

Same for `@Post('register')` and `@Post('forgot-password')` (if exists).

Add import at top: `import { Throttle } from '@nestjs/throttler';`

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=throttler`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/app.module.ts apps/backend/src/modules/auth/auth.controller.ts apps/backend/test/security/throttler.e2e-spec.ts
git commit -m "fix(security): throttle auth endpoints to 5/min, lower global to 60/min"
```

---

## Task 4: Encrypt accessCredentials

**Files:**
- Create: `apps/backend/src/shared/core/encryption/credential-cipher.service.ts`
- Create: `apps/backend/src/shared/core/encryption/encryption.module.ts`
- Modify: `apps/backend/src/shared/shared.module.ts` (or `app.module.ts` imports)
- Modify: `apps/backend/src/modules/access-request/access-request.service.ts:166`
- Modify: `apps/backend/src/modules/access-request/access-request.module.ts` (import EncryptionModule)

- [ ] **Step 1: Create CredentialCipherService**

Create `apps/backend/src/shared/core/encryption/credential-cipher.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

@Injectable()
export class CredentialCipherService {
  private readonly logger = new Logger(CredentialCipherService.name);
  private readonly key: Buffer;
  private readonly algo = 'aes-256-gcm';

  constructor(config: ConfigService) {
    const secret = config.get<string>('ENCRYPTION_KEY') || config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set');
    // Derive 32-byte key from secret via scrypt
    const salt = config.get<string>('ENCRYPTION_SALT') || 'idesk-static-salt-v1';
    this.key = scryptSync(secret, salt, 32);
  }

  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algo, this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: v1:<base64(iv)>:<base64(tag)>:<base64(ciphertext)>
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  decrypt(payload: string): string {
    if (!payload || !payload.startsWith('v1:')) return payload;
    const [, ivB64, tagB64, encB64] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const enc = Buffer.from(encB64, 'base64');
    const decipher = createDecipheriv(this.algo, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }
}
```

- [ ] **Step 2: Create EncryptionModule**

Create `apps/backend/src/shared/core/encryption/encryption.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { CredentialCipherService } from './credential-cipher.service';

@Global()
@Module({
  providers: [CredentialCipherService],
  exports: [CredentialCipherService],
})
export class EncryptionModule {}
```

- [ ] **Step 3: Register EncryptionModule**

In `apps/backend/src/app.module.ts`, add to `imports: []` array:

```typescript
import { EncryptionModule } from './shared/core/encryption/encryption.module';
// ... inside imports: [ EncryptionModule, ... ]
```

- [ ] **Step 4: Add env var to .env.example**

In `apps/backend/.env.example`, append:

```
# 32+ char secret used for AES-256-GCM credential encryption
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=change-me-to-32-byte-random-hex
```

- [ ] **Step 5: Write unit test**

Create `apps/backend/test/unit/encryption/credential-cipher.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CredentialCipherService } from '../../../src/shared/core/encryption/credential-cipher.service';

describe('CredentialCipherService', () => {
  let svc: CredentialCipherService;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-32-bytes-long-string-ok';
    const mod = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, load: [() => process.env] })],
      providers: [CredentialCipherService],
    }).compile();
    svc = mod.get(CredentialCipherService);
  });

  it('round-trips a credential', () => {
    const plain = 'S3cret!Pass#2026';
    const enc = svc.encrypt(plain);
    expect(enc).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(svc.decrypt(enc)).toBe(plain);
  });

  it('returns empty input unchanged', () => {
    expect(svc.encrypt('')).toBe('');
    expect(svc.decrypt('')).toBe('');
  });

  it('returns non-v1 payload as-is (backward compat)', () => {
    expect(svc.decrypt('plaintext-legacy')).toBe('plaintext-legacy');
  });

  it('produces different ciphertext per call (IV randomness)', () => {
    const a = svc.encrypt('same');
    const b = svc.encrypt('same');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 6: Run unit test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=credential-cipher`
Expected: PASS — round-trip works, IV randomness confirmed.

- [ ] **Step 7: Wire encryption in access-request service**

In `apps/backend/src/modules/access-request/access-request.service.ts`:

Add import at top:
```typescript
import { CredentialCipherService } from '../../shared/core/encryption/credential-cipher.service';
```

Inject in constructor (find existing constructor):
```typescript
  constructor(
    // ... existing deps
    private readonly cipher: CredentialCipherService,
  ) {}
```

Find the `createAccess` method around line 166 and wrap the assignment:
```typescript
      // BEFORE:
      accessCredentials: dto.accessCredentials, // Should be encrypted in production
      // AFTER:
      accessCredentials: this.cipher.encrypt(dto.accessCredentials),
```

In the `findOne` / response shape, decrypt on read:
```typescript
      accessCredentials: this.cipher.decrypt(record.accessCredentials),
```

(If `findAll` returns these in list, decrypt in projection or create a `toResponseDto`.)

- [ ] **Step 8: Write integration test**

Create `apps/backend/test/unit/access-request/access-request.service.encrypt.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CredentialCipherService } from '../../../src/shared/core/encryption/credential-cipher.service';
import { AccessRequestService } from '../../../src/modules/access-request/access-request.service';

describe('AccessRequestService encryption', () => {
  let svc: AccessRequestService;
  let cipher: CredentialCipherService;
  let mockRepo: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-32-bytes-long-string-ok';
    mockRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn(async (e) => ({ id: '1', ...e })),
      findOne: jest.fn(),
    };
    const mod = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, load: [() => process.env] })],
      providers: [
        CredentialCipherService,
        AccessRequestService,
        { provide: getRepositoryToken(/* AccessRequest entity name */), useValue: mockRepo },
        // mock other repos as needed (Ticket, AccessType, User)
      ],
    }).compile();
    svc = mod.get(AccessRequestService);
    cipher = mod.get(CredentialCipherService);
  });

  it('encrypts credentials on createAccess', async () => {
    const dto = { /* ... */ accessCredentials: 'plain-secret-123' };
    await svc.createAccess(dto as any);
    const savedArg = mockRepo.save.mock.calls[0][0];
    expect(savedArg.accessCredentials).toMatch(/^v1:/);
    expect(savedArg.accessCredentials).not.toContain('plain-secret-123');
  });
});
```

(Adjust mock entity token to match the real entity name — find via `rtk grep "forFeature" apps/backend/src/modules/access-request/access-request.module.ts`.)

- [ ] **Step 9: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=access-request.service.encrypt`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/src/shared/core/encryption/ apps/backend/src/app.module.ts apps/backend/src/modules/access-request/ apps/backend/.env.example apps/backend/test/
git commit -m "feat(security): AES-256-GCM encrypt access-request credentials, no plain-text at rest"
```

---

## Task 5: Add forbidNonWhitelisted to ValidationPipe

**Files:**
- Modify: `apps/backend/src/main.ts:107-110`

- [ ] **Step 1: Read current ValidationPipe config**

Run: `rtk read apps/backend/src/main.ts:105-112`
Expected: `useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`.

- [ ] **Step 2: Add forbidNonWhitelisted**

Edit to:
```typescript
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
```

- [ ] **Step 3: Smoke test (no new test, verify existing e2e pass)**

Run: `cd apps/backend && npm test -- --testPathPattern=e2e`
Expected: existing tests pass. If any test sends extra fields, that test needs `@Allow()` decorator on DTO.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/main.ts
git commit -m "fix(security): ValidationPipe forbidNonWhitelisted catches API contract drift"
```

---

## Task 6: getManyAndCount in ticket-query.findAllPaginated

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts:227-238`

- [ ] **Step 1: Read current implementation**

Run: `rtk read apps/backend/src/modules/ticketing/services/ticket-query.service.ts:220-245`
Expected: `getCount()` then `getMany()` pattern.

- [ ] **Step 2: Write unit test**

Create `apps/backend/test/unit/ticketing/ticket-query.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TicketQueryService } from '../../../src/modules/ticketing/services/ticket-query.service';
import { Ticket } from '../../../src/modules/ticketing/entities/ticket.entity';

describe('TicketQueryService.findAllPaginated', () => {
  let svc: TicketQueryService;
  let mockQb: any;

  beforeAll(async () => {
    mockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 't1' }], 42]),
      // Deprecated path — should NOT be called:
      getCount: jest.fn(),
      getMany: jest.fn(),
    };
    const mod = await Test.createTestingModule({
      providers: [
        TicketQueryService,
        { provide: getRepositoryToken(Ticket), useValue: { createQueryBuilder: () => mockQb } },
      ],
    }).compile();
    svc = mod.get(TicketQueryService);
  });

  it('uses getManyAndCount (single round-trip) for paginated list', async () => {
    const result = await svc.findAllPaginated({ page: 1, limit: 20 } as any);
    expect(mockQb.getManyAndCount).toHaveBeenCalled();
    expect(mockQb.getCount).not.toHaveBeenCalled();
    expect(mockQb.getMany).not.toHaveBeenCalled();
    expect(result.total).toBe(42);
  });
});
```

(Adjust the DTO type to match the real `findAllPaginated` signature — find via `rtk grep "findAllPaginated(" apps/backend/src/modules/ticketing/services/ticket-query.service.ts`.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/backend && npm test -- --testPathPattern=ticket-query.service`
Expected: FAIL — current code calls `getCount`+`getMany`, test asserts not called.

- [ ] **Step 4: Refactor to getManyAndCount**

In `apps/backend/src/modules/ticketing/services/ticket-query.service.ts:227-238`, replace the `getCount`+`getMany` block with a single call. Pattern:

```typescript
  async findAllPaginated(filters: ListTicketsDto): Promise<{ data: Ticket[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, ...rest } = filters;
    const qb = this.ticketRepo.createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.messages', 'msg')
      // ... existing joins
      .where(/* existing conditions on rest */)
      .orderBy('ticket.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
```

(Adjust to match exact existing structure — preserve all WHERE conditions, joins, orderings.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=ticket-query.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-query.service.ts apps/backend/test/unit/ticketing/ticket-query.service.spec.ts
git commit -m "perf(ticketing): getManyAndCount in findAllPaginated, 1 round-trip instead of 2"
```

---

## Task 7: Multer File Size Limit + Shared Interceptor

**Files:**
- Create: `apps/backend/src/modules/ticketing/presentation/interceptors/attachment-upload.interceptor.ts`
- Modify: `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts:62-70, 179-187`

- [ ] **Step 1: Create shared interceptor**

Create `apps/backend/src/modules/ticketing/presentation/interceptors/attachment-upload.interceptor.ts`:

```typescript
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { existsSync, mkdirSync } from 'fs';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads', 'tickets');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_REQUEST = 5;

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const storage = diskStorage({
  destination: (req, _file, cb) => {
    const ticketId = (req.params?.id as string) || 'unscoped';
    const dest = join(UPLOAD_ROOT, ticketId);
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]/g, '_');
    cb(null, `${Date.now()}-${uuid()}${extname(safe)}`);
  },
});

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowed = /\.(pdf|png|jpe?g|gif|webp|docx?|xlsx?|txt|csv|zip)$/i;
  if (!allowed.test(file.originalname)) {
    return cb(new Error('Unsupported file type'), false);
  }
  cb(null, true);
};

const limits = { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_REQUEST };

export const AttachmentSingleInterceptor = () =>
  FileInterceptor('files', { storage, fileFilter, limits });

export const AttachmentMultiInterceptor = () =>
  FilesInterceptor('files', MAX_FILES_PER_REQUEST, { storage, fileFilter, limits });
```

- [ ] **Step 2: Update tickets.controller.ts imports + decorators**

In `apps/backend/src/modules/ticketing/presentation/tickets.controller.ts`:

Remove imports:
```typescript
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
```

Add import:
```typescript
import { AttachmentMultiInterceptor } from './interceptors/attachment-upload.interceptor';
```

Replace `@FilesInterceptor('files', 5, ...)` decorators (at L62 and L179) with `@UseInterceptors(AttachmentMultiInterceptor())`.

- [ ] **Step 3: Verify build**

Run: `cd apps/backend && npm run build`
Expected: exit 0, no TS errors.

- [ ] **Step 4: Smoke test upload still works**

Run: `cd apps/backend && npm test -- --testPathPattern=tickets`
Expected: existing ticket tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ticketing/presentation/interceptors/ apps/backend/src/modules/ticketing/presentation/tickets.controller.ts
git commit -m "fix(security): multer fileSize 10MB cap + shared attachment interceptor, mime whitelist"
```

---

## Task 8: Permission Guard Redis Cache

**Files:**
- Modify: `apps/backend/src/modules/permissions/permission.guard.ts:52-56`
- Modify: `apps/backend/src/modules/permissions/permissions.service.ts:695-711`

- [ ] **Step 1: Read current hasPermission implementation**

Run: `rtk read apps/backend/src/modules/permissions/permissions.service.ts:690-720`
Expected: `hasPermission(userId, feature, action)` does `findOne` per call.

- [ ] **Step 2: Add cache wrapper methods in PermissionsService**

In `apps/backend/src/modules/permissions/permissions.service.ts`, add to the class (or extend existing methods):

```typescript
  async hasPermissionCached(userId: string, featureKey: string, action: string): Promise<boolean> {
    const cacheKey = `perm:${userId}:${featureKey}:${action}`;
    const cached = await this.cacheService.getAsync<boolean>(cacheKey);
    if (cached !== undefined && cached !== null) return cached as boolean;

    const result = await this.hasPermission(userId, featureKey, action);
    await this.cacheService.setAsync(cacheKey, result, { ttl: 60 }); // 60s
    return result;
  }

  async invalidatePermissionCache(userId: string): Promise<void> {
    // Use SCAN if many keys; for small cardinality, KEYS is acceptable in dev
    const pattern = `perm:${userId}:*`;
    await this.cacheService.delByPattern?.(pattern) ?? this.cacheService.delAsync(pattern);
  }
```

(Adapt to the actual `CacheService` API — find via `rtk grep "class CacheService" apps/backend/src/shared/core/cache/`. If API differs, match the existing method names.)

- [ ] **Step 3: Update PermissionGuard to use cached path**

In `apps/backend/src/modules/permissions/permission.guard.ts:52-56`, replace direct `hasPermission` call:

```typescript
  // BEFORE:
  const allowed = await this.permissionsService.hasPermission(userId, feature, action);
  // AFTER:
  const allowed = await this.permissionsService.hasPermissionCached(userId, feature, action);
```

- [ ] **Step 4: Write unit test**

Create `apps/backend/test/unit/permissions/permission.guard.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { PermissionGuard } from '../../../src/modules/permissions/permission.guard';
import { PermissionsService } from '../../../src/modules/permissions/permissions.service';

describe('PermissionGuard cache', () => {
  let guard: PermissionGuard;
  let svc: jest.Mocked<PermissionsService>;
  let ctx: ExecutionContext;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        {
          provide: PermissionsService,
          useValue: {
            hasPermission: jest.fn().mockResolvedValue(true),
            hasPermissionCached: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();
    guard = mod.get(PermissionGuard);
    svc = mod.get(PermissionsService) as jest.Mocked<PermissionsService>;
    ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { userId: 'u1' }, route: { path: '/tickets' } }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  });

  it('delegates to hasPermissionCached (not hasPermission)', async () => {
    await guard.canActivate(ctx);
    expect(svc.hasPermissionCached).toHaveBeenCalled();
    expect(svc.hasPermission).not.toHaveBeenCalled();
  });
});
```

(Adjust guard's `canActivate` signature — find via `rtk read apps/backend/src/modules/permissions/permission.guard.ts` to know what metadata decorators extract feature/action.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=permission.guard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/permissions/ apps/backend/test/unit/permissions/
git commit -m "perf(permissions): cache hasPermission 60s in Redis, eliminate per-request DB hit"
```

---

## Task 9: getActionItems LIMIT + Cache

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts:267-291`

- [ ] **Step 1: Read current getActionItems**

Run: `rtk read apps/backend/src/modules/notifications/notification-center.service.ts:260-295`
Expected: 6 `Promise.all` raw queries with no LIMIT.

- [ ] **Step 2: Add LIMIT 50 to each query and wrap in cache**

For each of the 6 queries inside `getActionItems`, add `.limit(50)` (or `.take(50)`) before the await. Pattern:

```typescript
    const [tickets] = await this.ticketRepo.createQueryBuilder('t')
      .where(/* existing conditions */)
      .orderBy('t.createdAt', 'DESC')
      .limit(50)
      .getMany();
```

Wrap the entire method body:

```typescript
  async getActionItems(userId: string): Promise<ActionItemDto[]> {
    return this.cacheService.getOrSet(
      `action-items:${userId}`,
      async () => { /* existing body, now with .limit(50) */ },
      30, // 30s TTL
    );
  }
```

(Adapt to actual `getOrSet` API in the codebase — find via `rtk grep "getOrSet" apps/backend/src/shared/core/cache/`.)

- [ ] **Step 3: Write unit test**

Create `apps/backend/test/unit/notifications/notification-center.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationCenterService } from '../../../src/modules/notifications/notification-center.service';
import { Ticket } from '../../../src/modules/ticketing/entities/ticket.entity';
import { CacheService } from '../../../src/shared/core/cache/cache.service';

describe('NotificationCenterService.getActionItems', () => {
  let svc: NotificationCenterService;
  let mockCache: any;
  let mockQb: any;

  beforeAll(async () => {
    mockCache = {
      getOrSet: jest.fn(async (key, fn, ttl) => fn()),
      getAsync: jest.fn(),
      setAsync: jest.fn(),
    };
    mockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const mod = await Test.createTestingModule({
      providers: [
        NotificationCenterService,
        { provide: CacheService, useValue: mockCache },
        { provide: getRepositoryToken(Ticket), useValue: { createQueryBuilder: () => mockQb } },
        // mock other repos
      ],
    }).compile();
    svc = mod.get(NotificationCenterService);
  });

  it('applies LIMIT 50 to each query', async () => {
    await svc.getActionItems('user-1');
    expect(mockQb.limit).toHaveBeenCalledWith(50);
  });

  it('wraps result in cache with 30s TTL', async () => {
    await svc.getActionItems('user-1');
    expect(mockCache.getOrSet).toHaveBeenCalledWith(
      'action-items:user-1',
      expect.any(Function),
      30,
    );
  });
});
```

(Adjust mock providers to match all 6 repos used in getActionItems — find via the file read in Step 1.)

- [ ] **Step 4: Run test to verify it fails, then passes after Step 2**

Run: `cd apps/backend && npm test -- --testPathPattern=notification-center.service`
Expected after Step 2: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts apps/backend/test/unit/notifications/
git commit -m "perf(notifications): LIMIT 50 + 30s cache in getActionItems, stop full-table scan per poll"
```

---

## Task 10: Cache Ticket Templates

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-template.service.ts:16, 38, 51`

- [ ] **Step 1: Read service**

Run: `rtk read apps/backend/src/modules/ticketing/services/ticket-template.service.ts`
Expected: 3 `find()` calls — list, byId, byCategory.

- [ ] **Step 2: Wrap each find in cache**

Pattern for each method:

```typescript
  async findAll(): Promise<TicketTemplate[]> {
    return this.cacheService.getOrSet(
      'ticket-templates:all',
      async () => this.templateRepo.find(),
      60, // 60s
    );
  }

  async findById(id: string): Promise<TicketTemplate | null> {
    return this.cacheService.getOrSet(
      `ticket-templates:${id}`,
      async () => this.templateRepo.findOne({ where: { id } }),
      60,
    );
  }

  async findByCategory(category: TicketCategory): Promise<TicketTemplate[]> {
    return this.cacheService.getOrSet(
      `ticket-templates:cat:${category}`,
      async () => this.templateRepo.find({ where: { category } }),
      60,
    );
  }
```

Inject `CacheService` via constructor.

- [ ] **Step 3: Add cache invalidation on template mutation**

Find `create`/`update`/`delete` methods, after successful save add:

```typescript
    await this.cacheService.delAsync('ticket-templates:all');
    await this.cacheService.delAsync(`ticket-templates:${id}`);
    await this.cacheService.delAsync(`ticket-templates:cat:${category}`);
```

- [ ] **Step 4: Write unit test**

Create `apps/backend/test/unit/ticketing/ticket-template.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TicketTemplateService } from '../../../src/modules/ticketing/services/ticket-template.service';
import { TicketTemplate } from '../../../src/modules/ticketing/entities/ticket-template.entity';
import { CacheService } from '../../../src/shared/core/cache/cache.service';

describe('TicketTemplateService caching', () => {
  let svc: TicketTemplateService;
  let mockCache: any;
  let mockRepo: any;

  beforeAll(async () => {
    mockCache = {
      getOrSet: jest.fn(async (k, fn) => fn()),
      delAsync: jest.fn(),
    };
    mockRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        TicketTemplateService,
        { provide: CacheService, useValue: mockCache },
        { provide: getRepositoryToken(TicketTemplate), useValue: mockRepo },
      ],
    }).compile();
    svc = mod.get(TicketTemplateService);
  });

  it('findAll uses cache with 60s TTL', async () => {
    await svc.findAll();
    expect(mockCache.getOrSet).toHaveBeenCalledWith(
      'ticket-templates:all',
      expect.any(Function),
      60,
    );
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=ticket-template.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-template.service.ts apps/backend/test/unit/ticketing/ticket-template.service.spec.ts
git commit -m "perf(ticketing): 60s cache on ticket template lookups (static reference data)"
```

---

## Task 11: Cache Hardware Catalog

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/services/hardware-catalog.service.ts:18, 25`

- [ ] **Step 1: Read service**

Run: `rtk read apps/backend/src/modules/hardware-request/services/hardware-catalog.service.ts`
Expected: `findAll()` and `findByCategory()` returning list.

- [ ] **Step 2: Wrap in cache (same pattern as Task 10)**

```typescript
  async findAll(): Promise<HardwareCatalogItem[]> {
    return this.cacheService.getOrSet('hw-catalog:all', async () => {
      return this.catalogRepo.find();
    }, 60);
  }

  async findByCategory(category: string): Promise<HardwareCatalogItem[]> {
    return this.cacheService.getOrSet(`hw-catalog:cat:${category}`, async () => {
      return this.catalogRepo.find({ where: { category } });
    }, 60);
  }
```

Add cache invalidation on create/update/delete.

- [ ] **Step 3: Write unit test**

Mirror Task 10 spec, with `hw-catalog:*` keys and TTL 60.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && npm test -- --testPathPattern=hardware-catalog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-catalog.service.ts apps/backend/test/unit/hardware-request/
git commit -m "perf(hardware): 60s cache on hardware catalog list (hit per request form open)"
```

---

## Verification & Sign-off

- [ ] **Run full backend test suite**

Run: `cd apps/backend && npm test`
Expected: all tests pass.

- [ ] **Run e2e security suite**

Run: `cd apps/backend && npm run test:e2e -- --testPathPattern=security`
Expected: 3 e2e tests pass (helmet, body-size, throttler).

- [ ] **Build verification**

Run: `cd apps/backend && npm run build`
Expected: exit 0.

- [ ] **Coverage check on changed files**

Run: `cd apps/backend && npm run test:cov`
Expected: ≥80% coverage on the 11 modified/created service files.

- [ ] **Manual smoke test on running backend**

1. `cd apps/backend && npm run start:dev`
2. `curl -i http://localhost:3000/this-does-not-exist` — verify `x-content-type-options: nosniff` header present (Task 1)
3. `curl -i -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"x","password":"y"}'` × 6 — verify 6th returns 429 (Task 3)
4. Create an access-request via UI/API, verify DB row has `accessCredentials` starting with `v1:` (Task 4)

- [ ] **Final commit & tag**

```bash
git tag backend-perf-plan-01-complete
git log --oneline -11
```

---

## Out-of-Scope (Handled in Plan 02-04)

- Plan 02: Manager dashboard N+1, getActionItems deeper refactor, all list endpoint pagination, all `getCount`+`getMany` migrations
- Plan 03: Ticketing multi-step transactions (messaging, update, merge, sla-monitor), hardware mutual-scheduling, lost-item match/reject, access-request writes
- Plan 04: Sites active list cache, settings scheduling cache, SLA config cache, business hours cache, sound/synology/telegram caching

---

**Status:** Plan 01 saved. 11 tasks, ~3 jam eksekusi. Ready for user approval.
