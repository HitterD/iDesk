# Zoom Booking Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 critical issues in zoom-booking module: configurable max booking limit, weekend availability, 24h default slot, load % bug, and account identification in calendar grid.

**Architecture:** Mixed backend (entity defaults + DTO + migration) and frontend (hook fix + remove hardcode + UI label). Backend changes follow TDD where tests exist; frontend changes use TDD for bug fixes and new behaviors.

**Tech Stack:** NestJS + TypeORM (backend), React + TanStack Query (frontend), Vitest (frontend tests), Jest (backend tests), date-fns, lucide-react.

**Spec:** [docs/superpowers/specs/2026-06-19-zoom-booking-fixes.md](../specs/2026-06-19-zoom-booking-fixes.md)

---

## File Structure

**Backend (modify):**
- `apps/backend/src/modules/zoom-booking/entities/zoom-settings.entity.ts` — change default values
- `apps/backend/src/modules/zoom-booking/dto/zoom-settings.dto.ts` — remove `@Max(50)`
- `apps/backend/src/modules/zoom-booking/services/zoom-settings.service.ts` — change factory defaults

**Backend (create):**
- `apps/backend/src/migrations/1779000000000-UpdateZoomSettingsDefaults.ts` — safe data migration
- `apps/backend/src/modules/zoom-booking/services/__tests__/zoom-settings.service.spec.ts` — verify new defaults

**Frontend (modify):**
- `apps/frontend/src/features/zoom-booking/hooks/useAccountLoadSummary.ts` — drop `slot.status` filter
- `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx` — remove hardcode weekend, add account name in cell
- `apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx` — same
- `apps/frontend/src/features/zoom-booking/components/ZoomMonthView.tsx` — add account name below title
- `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx` — remove hardcode weekend
- `apps/frontend/src/features/zoom-booking/components/ZoomOverflowPopover.tsx` — verify rendering
- `apps/frontend/src/features/zoom-booking/components/ZoomCalendarGrid.tsx` — extend `ProcessedBookingV2` with `accountName`

**Frontend (create):**
- `apps/frontend/src/features/zoom-booking/hooks/__tests__/useAccountLoadSummary.test.ts`
- `apps/frontend/src/features/zoom-booking/hooks/useZoomSettings.ts`

---

## Task 1: Update ZoomSettings entity defaults

**Files:**
- Modify: `apps/backend/src/modules/zoom-booking/entities/zoom-settings.entity.ts`

- [ ] **Step 1: Update default values**

Edit `apps/backend/src/modules/zoom-booking/entities/zoom-settings.entity.ts`:

```typescript
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    UpdateDateColumn,
} from 'typeorm';

@Entity('zoom_settings')
export class ZoomSettings {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'int', default: 60 })
    defaultDurationMinutes: number;

    @Column({ type: 'int', default: 30 })
    advanceBookingDays: number;

    @Column({ type: 'time', default: '00:00' })
    slotStartTime: string;

    @Column({ type: 'time', default: '23:59' })
    slotEndTime: string;

    @Column({ type: 'int', default: 30 })
    slotIntervalMinutes: number;

    @Column({ type: 'jsonb', default: '[]' })
    blockedDates: string[];

    @Column({ type: 'jsonb', default: '[0,1,2,3,4,5,6]' })
    workingDays: number[];

    @Column({ default: false })
    requireDescription: boolean;

    @Column({ type: 'int', default: 50 })
    maxBookingPerUserPerDay: number;

    @Column({ type: 'jsonb', default: '[30, 60, 90, 120]' })
    allowedDurations: number[];

    @UpdateDateColumn()
    updatedAt: Date;
}
```

- [ ] **Step 2: Commit**

```bash
cd apps/backend
git add src/modules/zoom-booking/entities/zoom-settings.entity.ts
git commit -m "feat(zoom-settings): update entity defaults to 50/day, all days, 24h"
```

---

## Task 2: Remove @Max(50) cap from DTO

**Files:**
- Modify: `apps/backend/src/modules/zoom-booking/dto/zoom-settings.dto.ts`

- [ ] **Step 1: Remove @Max decorator**

Find:
```typescript
    @ApiPropertyOptional({ description: 'Max bookings per user per day' })
    @IsInt()
    @Min(1)
    @Max(50)
    @IsOptional()
    maxBookingPerUserPerDay?: number;
```

Replace with:
```typescript
    @ApiPropertyOptional({ description: 'Max bookings per user per day (no upper cap)' })
    @IsInt()
    @Min(1)
    @IsOptional()
    maxBookingPerUserPerDay?: number;
```

- [ ] **Step 2: Commit**

```bash
cd apps/backend
git add src/modules/zoom-booking/dto/zoom-settings.dto.ts
git commit -m "feat(zoom-settings): remove hard cap of 50 on maxBookingPerUserPerDay"
```

---

## Task 3: Update ZoomSettingsService factory defaults

**Files:**
- Modify: `apps/backend/src/modules/zoom-booking/services/zoom-settings.service.ts`

- [ ] **Step 1: Update factory in getSettings()**

Find the `getSettings()` method and update the `settingsRepo.create({...})` call:

```typescript
        if (!settings) {
            this.logger.log('Creating default Zoom booking settings');
            settings = this.settingsRepo.create({
                defaultDurationMinutes: 60,
                advanceBookingDays: 30,
                slotStartTime: '00:00',
                slotEndTime: '23:59',
                slotIntervalMinutes: 30,
                blockedDates: [],
                workingDays: [0, 1, 2, 3, 4, 5, 6],
                requireDescription: false,
                maxBookingPerUserPerDay: 50,
                allowedDurations: [30, 60, 90, 120],
            });
            await this.settingsRepo.save(settings);
        }
```

- [ ] **Step 2: Commit**

```bash
cd apps/backend
git add src/modules/zoom-booking/services/zoom-settings.service.ts
git commit -m "feat(zoom-settings): update service factory defaults"
```

---

## Task 4: Add migration for existing rows

**Files:**
- Create: `apps/backend/src/migrations/1779000000000-UpdateZoomSettingsDefaults.ts`

- [ ] **Step 1: Create migration file**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateZoomSettingsDefaults1779000000000
    implements MigrationInterface
{
    name = 'UpdateZoomSettingsDefaults1779000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE zoom_settings
            SET
                "maxBookingPerUserPerDay" = 50,
                "workingDays" = '[0,1,2,3,4,5,6]'::jsonb,
                "slotStartTime" = '00:00',
                "slotEndTime" = '23:59',
                "updatedAt" = NOW()
            WHERE
                "maxBookingPerUserPerDay" = 5
                OR "workingDays" = '[1,2,3,4,5]'::jsonb
                OR "slotStartTime" = '08:00'
                OR "slotEndTime" = '18:00'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE zoom_settings
            SET
                "maxBookingPerUserPerDay" = 5,
                "workingDays" = '[1,2,3,4,5]'::jsonb,
                "slotStartTime" = '08:00',
                "slotEndTime" = '18:00',
                "updatedAt" = NOW()
            WHERE
                "maxBookingPerUserPerDay" = 50
                AND "workingDays" = '[0,1,2,3,4,5,6]'::jsonb
                AND "slotStartTime" = '00:00'
                AND "slotEndTime" = '23:59'
        `);
    }
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/backend
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd apps/backend
git add src/migrations/1779000000000-UpdateZoomSettingsDefaults.ts
git commit -m "feat(zoom-settings): migration to upgrade existing rows to new defaults"
```

---

## Task 5: Add backend service test for new defaults

**Files:**
- Create: `apps/backend/src/modules/zoom-booking/services/__tests__/zoom-settings.service.spec.ts`

- [ ] **Step 1: Write test**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZoomSettingsService } from '../zoom-settings.service';
import { ZoomSettings } from '../../entities/zoom-settings.entity';

describe('ZoomSettingsService', () => {
    let service: ZoomSettingsService;

    const mockRepo = {
        findOne: jest.fn(),
        create: jest.fn((dto) => dto as ZoomSettings),
        save: jest.fn((entity) => Promise.resolve(entity as ZoomSettings)),
    } as unknown as jest.Mocked<Repository<ZoomSettings>>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ZoomSettingsService,
                { provide: getRepositoryToken(ZoomSettings), useValue: mockRepo },
            ],
        }).compile();

        service = module.get<ZoomSettingsService>(ZoomSettingsService);
    });

    afterEach(() => jest.clearAllMocks());

    it('creates settings with 24h slot, all 7 days, 50/day cap on first run', async () => {
        mockRepo.findOne.mockResolvedValue(null);

        const result = await service.getSettings();

        expect(result.slotStartTime).toBe('00:00');
        expect(result.slotEndTime).toBe('23:59');
        expect(result.workingDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(result.maxBookingPerUserPerDay).toBe(50);
        expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('accepts maxBookingPerUserPerDay = 500 (no upper cap)', async () => {
        const existing = { id: '1' } as ZoomSettings;
        mockRepo.findOne.mockResolvedValue(existing);

        const result = await service.updateSettings({ maxBookingPerUserPerDay: 500 });

        expect(result.maxBookingPerUserPerDay).toBe(500);
    });
});
```

- [ ] **Step 2: Run test**

```bash
cd apps/backend
npm test -- zoom-settings.service.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd apps/backend
git add src/modules/zoom-booking/services/__tests__/zoom-settings.service.spec.ts
git commit -m "test(zoom-settings): verify new defaults and unbounded max"
```

---

## Task 6: Fix useAccountLoadSummary counting (TDD)

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/hooks/__tests__/useAccountLoadSummary.test.ts`
- Modify: `apps/frontend/src/features/zoom-booking/hooks/useAccountLoadSummary.ts`

- [ ] **Step 1: Write test**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAccountLoadSummary } from '../useAccountLoadSummary';
import api from '@/lib/api';
import type { CalendarDay, ZoomAccount } from '../../types';

jest.mock('@/lib/api');
const mockedApi = api as jest.Mocked<typeof api>;

const accounts: ZoomAccount[] = [
    { id: 'acc-1', name: 'Marketing', colorHex: '#f00' } as unknown as ZoomAccount,
];

function makeDay(bookings: Array<{ id: string; status: string }>): CalendarDay {
    return {
        date: '2026-06-19',
        dayOfWeek: 5,
        isWorkingDay: true,
        isBlocked: false,
        slots: bookings.map((b, i) => ({
            date: '2026-06-19',
            time: `${8 + i}:00`,
            endTime: `${9 + i}:00`,
            status: b.status as 'booked' | 'my_booking' | 'available',
            booking: {
                id: b.id,
                title: `mtg-${b.id}`,
                bookedBy: 'user-1',
                durationMinutes: 60,
                startTime: `${8 + i}:00`,
                endTime: `${9 + i}:00`,
            },
        })),
    };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
    </QueryClientProvider>
);

describe('useAccountLoadSummary', () => {
    it('counts 2 meetings on 1 day as loadPercent 13 (2/16)', async () => {
        mockedApi.get.mockResolvedValue({ data: [makeDay([
            { id: 'b1', status: 'booked' },
            { id: 'b2', status: 'my_booking' },
        ])] } as any);

        const { result } = renderHook(
            () => useAccountLoadSummary(accounts, '2026-06-19', '2026-06-19'),
            { wrapper }
        );
        await waitFor(() => result.current.length > 0);

        expect(result.current[0].meetingsInRange).toBe(2);
        expect(result.current[0].loadPercent).toBe(13);
    });

    it('counts 0 meetings as loadPercent 0', async () => {
        mockedApi.get.mockResolvedValue({ data: [makeDay([])] } as any);

        const { result } = renderHook(
            () => useAccountLoadSummary(accounts, '2026-06-19', '2026-06-19'),
            { wrapper }
        );
        await waitFor(() => result.current.length > 0);

        expect(result.current[0].meetingsInRange).toBe(0);
        expect(result.current[0].loadPercent).toBe(0);
    });

    it('deduplicates recurring booking across slots (counted once)', async () => {
        const day = makeDay([
            { id: 'recurring-1', status: 'booked' },
            { id: 'recurring-1', status: 'booked' },
        ]);
        mockedApi.get.mockResolvedValue({ data: [day] } as any);

        const { result } = renderHook(
            () => useAccountLoadSummary(accounts, '2026-06-19', '2026-06-19'),
            { wrapper }
        );
        await waitFor(() => result.current.length > 0);

        expect(result.current[0].meetingsInRange).toBe(1);
    });
});
```

- [ ] **Step 2: Run test**

```bash
cd apps/frontend
npm test -- useAccountLoadSummary.test.ts
```

- [ ] **Step 3: If 2-meetings test fails, fix hook counting**

In `apps/frontend/src/features/zoom-booking/hooks/useAccountLoadSummary.ts`, find the counting reduce. Replace:

```typescript
const meetingsInRange = days
    ? days.reduce((sum, day) => {
          const seen = new Set<string>();
          for (const slot of day.slots) {
              if (
                  slot.booking &&
                  (slot.status === 'booked' || slot.status === 'my_booking') &&
                  !seen.has(slot.booking.id)
              ) {
                  seen.add(slot.booking.id);
                  sum += 1;
              }
          }
          return sum;
      }, 0)
    : 0;
```

With:

```typescript
const meetingsInRange = days
    ? days.reduce((sum, day) => {
          const seen = new Set<string>();
          for (const slot of day.slots) {
              if (slot.booking && !seen.has(slot.booking.id)) {
                  seen.add(slot.booking.id);
                  sum += 1;
              }
          }
          return sum;
      }, 0)
    : 0;
```

Re-run test. Expected: all 3 PASS.

- [ ] **Step 4: Commit**

```bash
cd apps/frontend
git add src/features/zoom-booking/hooks/useAccountLoadSummary.ts src/features/zoom-booking/hooks/__tests__/useAccountLoadSummary.test.ts
git commit -m "fix(load-summary): count all bookings regardless of slot status"
```

---

## Task 7: Create useZoomSettings hook (frontend)

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/hooks/useZoomSettings.ts`

- [ ] **Step 1: Check if hook exists**

```bash
find apps/frontend/src/features/zoom-booking -name "useZoomSettings*"
```

If files exist, skip to Task 8.

- [ ] **Step 2: Create hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface PublicZoomSettings {
    slotStartTime: string;
    slotEndTime: string;
    slotIntervalMinutes: number;
    workingDays: number[];
    advanceBookingDays: number;
    allowedDurations: number[];
}

const STALE_TIME = 60_000;

export function useZoomSettings(enabled = true) {
    return useQuery<PublicZoomSettings>({
        queryKey: ['zoom-public-settings'],
        queryFn: async () => {
            const res = await api.get('/zoom-booking/settings');
            return res.data;
        },
        enabled,
        staleTime: STALE_TIME,
    });
}

export function isWorkingDay(date: Date, workingDays: number[]): boolean {
    return workingDays.includes(date.getDay());
}
```

- [ ] **Step 3: Commit**

```bash
cd apps/frontend
git add src/features/zoom-booking/hooks/useZoomSettings.ts
git commit -m "feat(hooks): add useZoomSettings for workingDays, slot range"
```

---

## Task 8: Remove hardcoded weekend in ZoomWeekView (TDD)

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx`

- [ ] **Step 1: Verify existing test exists**

```bash
ls apps/frontend/src/features/zoom-booking/components/__tests__/ZoomWeekView.test.tsx
```

If missing, create scaffold. If present, continue.

- [ ] **Step 2: Add import to ZoomWeekView.tsx**

Add at top:
```typescript
import { useZoomSettings, isWorkingDay } from '../hooks/useZoomSettings';
```

- [ ] **Step 3: Use settings inside component**

After existing `useState`/`useMemo`:
```typescript
const { data: zoomSettings } = useZoomSettings();
const workingDays = zoomSettings?.workingDays ?? [1, 2, 3, 4, 5];
```

- [ ] **Step 4: Replace hardcoded weekend check**

Find the cell rendering and replace:

```tsx
(day.getDay() === 0 || day.getDay() === 6) && 'bg-slate-100/80 dark:bg-slate-800/40 opacity-60 cursor-not-allowed'
```

with:

```tsx
!isWorkingDay(day, workingDays) && 'bg-slate-100/80 dark:bg-slate-800/40 opacity-60 cursor-not-allowed'
```

Also replace the click handler:
```tsx
onClick={() => {
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    if (calDay && !isWeekend) onSlotClick(calDay, timeIndex);
}}
```

with:

```tsx
onClick={() => {
    if (calDay && isWorkingDay(day, workingDays)) onSlotClick(calDay, timeIndex);
}}
```

- [ ] **Step 5: Update existing test mock**

If `ZoomWeekView.test.tsx` mocks settings, ensure mock returns `workingDays: [0,1,2,3,4,5,6]`. Add if missing:

```typescript
import * as settingsHook from '../../hooks/useZoomSettings';
jest.mock('../../hooks/useZoomSettings');
const mockedSettings = settingsHook.useZoomSettings as jest.Mock;

beforeEach(() => {
    mockedSettings.mockReturnValue({
        data: { workingDays: [0, 1, 2, 3, 4, 5, 6], slotStartTime: '00:00', slotEndTime: '23:59' },
        isLoading: false,
    });
});
```

- [ ] **Step 6: Run test**

```bash
cd apps/frontend
npm test -- ZoomWeekView.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd apps/frontend
git add src/features/zoom-booking/components/ZoomWeekView.tsx src/features/zoom-booking/components/__tests__/ZoomWeekView.test.tsx
git commit -m "fix(week-view): use settings.workingDays instead of hardcoded weekend"
```

---

## Task 9: Remove hardcoded weekend in ZoomDayView and ZoomBookingForm

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx`

- [ ] **Step 1: Search for hardcoded weekend**

```bash
grep -n "getDay() === 0\|getDay() === 6\|isWeekend" apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx apps/frontend/src/features/zoom-booking/components/ZoomBookingForm.tsx
```

- [ ] **Step 2: Replace each occurrence**

For each match, apply the same pattern as Task 8:
- Import `useZoomSettings, isWorkingDay` from `../hooks/useZoomSettings`.
- Add `const { data: zoomSettings } = useZoomSettings(); const workingDays = zoomSettings?.workingDays ?? [1, 2, 3, 4, 5];` in component.
- Replace `day.getDay() === 0 || day.getDay() === 6` with `!isWorkingDay(day, workingDays)`.

- [ ] **Step 3: Run tests**

```bash
cd apps/frontend
npm test -- ZoomDayView ZoomBookingForm
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd apps/frontend
git add src/features/zoom-booking/components/ZoomDayView.tsx src/features/zoom-booking/components/ZoomBookingForm.tsx
git commit -m "fix(day-view,booking-form): use settings.workingDays instead of hardcoded weekend"
```

---

## Task 10: Extend ProcessedBookingV2 with accountName

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomCalendarGrid.tsx`

- [ ] **Step 1: Add accountName to interface**

Find the `ProcessedBookingV2` interface and add `accountName: string;`:

```typescript
export interface ProcessedBookingV2 {
    id: string;
    title: string;
    bookedBy: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    rowStart: number;
    rowSpan: number;
    isMyBooking: boolean;
    isExternal: boolean;
    accountColorHex: string;
    accountName: string;
    rowIndex: number;
    totalRows: number;
    overflowCount: number;
}
```

- [ ] **Step 2: Populate accountName in processBookingsForDayV2**

Find the `all.push({...})` block. Update the `slotBooking` cast and push:

```typescript
const slotBooking = slot.booking as (CalendarSlot['booking'] & {
    zoomAccount?: { colorHex?: string; name?: string };
});
all.push({
    id: slot.booking.id,
    title: slot.booking.title,
    bookedBy: slot.booking.bookedBy,
    startTime: slot.booking.startTime || slot.time,
    endTime: slot.booking.endTime || slot.endTime,
    durationMinutes: slot.booking.durationMinutes,
    rowStart: index + 2,
    rowSpan,
    isMyBooking: slot.status === 'my_booking',
    isExternal: slot.booking.isExternal || false,
    accountColorHex: slotBooking?.zoomAccount?.colorHex ?? '#3b82f6',
    accountName: slotBooking?.zoomAccount?.name ?? 'Zoom',
    rowIndex: 0,
    totalRows: 0,
    overflowCount: 0,
});
```

- [ ] **Step 3: Check for breaking usages**

```bash
grep -rn "ProcessedBookingV2" apps/frontend/src/features/zoom-booking/
```

For any literal usage `as ProcessedBookingV2`, add `accountName: ''` if TypeScript complains.

- [ ] **Step 4: Commit**

```bash
cd apps/frontend
git add src/features/zoom-booking/components/ZoomCalendarGrid.tsx
git commit -m "feat(calendar-grid): add accountName to ProcessedBookingV2"
```

---

## Task 11: Add account name to ZoomWeekView cell (TDD)

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx`

- [ ] **Step 1: Write test**

Append to `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomWeekView.test.tsx`:

```typescript
describe('ZoomWeekView — account name in cell', () => {
    it('shows accountName text in booking cell', () => {
        const calendar = [{
            date: '2026-06-19',
            dayOfWeek: 5,
            isWorkingDay: true,
            isBlocked: false,
            slots: [{
                date: '2026-06-19',
                time: '10:00',
                endTime: '11:00',
                status: 'booked' as const,
                booking: {
                    id: 'b1',
                    title: 'Sprint Review',
                    bookedBy: 'user-1',
                    durationMinutes: 60,
                    startTime: '10:00',
                    endTime: '11:00',
                    accountColorHex: '#f00',
                },
            }],
        }];

        mockedSettings.mockReturnValue({
            data: { workingDays: [0, 1, 2, 3, 4, 5, 6], slotStartTime: '00:00', slotEndTime: '23:59' },
            isLoading: false,
        });

        render(
            <ZoomWeekView
                currentDate={new Date('2026-06-19')}
                calendar={calendar as any}
                timeLabels={['10:00', '10:30']}
                currentTime={new Date('2026-06-19T10:00:00')}
                canBook={true}
                onSlotClick={jest.fn()}
                onBookingClick={jest.fn()}
            />,
            { wrapper }
        );

        expect(screen.getByText(/Sprint Review/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test, verify**

```bash
cd apps/frontend
npm test -- ZoomWeekView.test.tsx
```

- [ ] **Step 3: Update cell render to include account name**

In `ZoomWeekView.tsx`, find the booking cell inner content. Replace:

Before:
```tsx
    <Video className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
    <span className="text-[10px] font-bold truncate">{booking.title}</span>
```

After:
```tsx
    <Video className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
    <span
        className="w-1.5 h-1.5 rounded-full bg-white/90 ring-1 ring-black/20 shrink-0"
        aria-hidden="true"
    />
    <span className="text-[9px] font-semibold opacity-95 truncate max-w-[60px]">
        {booking.accountName}
    </span>
    <span className="text-[10px] font-bold truncate">{booking.title}</span>
```

Also update the `title` attribute to include `Akun: ${booking.accountName}`.

- [ ] **Step 4: Update test to assert account name**

```typescript
expect(screen.getByText(/Marketing|Zoom/i)).toBeInTheDocument();
```

- [ ] **Step 5: Run test, verify pass**

```bash
cd apps/frontend
npm test -- ZoomWeekView.test.tsx
```

- [ ] **Step 6: Commit**

```bash
cd apps/frontend
git add src/features/zoom-booking/components/ZoomWeekView.tsx src/features/zoom-booking/components/__tests__/ZoomWeekView.test.tsx
git commit -m "feat(week-view): show color dot + account name in booking cell"
```

---

## Task 12: Add account name to ZoomDayView cell

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx`

- [ ] **Step 1: Find booking cell render**

```bash
grep -n "accountColorHex\|Video className" apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx
```

- [ ] **Step 2: Apply same pattern as Task 11 Step 3**

Add color dot span and account name span in the cell render. Update `title` to include `Akun: ${booking.accountName}`.

- [ ] **Step 3: Update test if exists**

Add `accountName` assertion.

- [ ] **Step 4: Run test**

```bash
cd apps/frontend
npm test -- ZoomDayView.test.tsx
```

- [ ] **Step 5: Commit**

```bash
cd apps/frontend
git add src/features/zoom-booking/components/ZoomDayView.tsx src/features/zoom-booking/components/__tests__/ZoomDayView.test.tsx
git commit -m "feat(day-view): show color dot + account name in booking cell"
```

---

## Task 13: Add account name to ZoomMonthView cell

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomMonthView.tsx`

- [ ] **Step 1: Find booking cell render**

```bash
grep -n "accountColorHex\|booking\.title" apps/frontend/src/features/zoom-booking/components/ZoomMonthView.tsx
```

- [ ] **Step 2: Add account name below title**

```tsx
<div className="..." style={{...}}>
    <span className="text-[9px] font-bold truncate">{booking.title}</span>
    <span
        className="w-1 h-1 rounded-full shrink-0"
        style={{ backgroundColor: booking.accountColorHex }}
        aria-hidden="true"
    />
    <span className="text-[8px] opacity-90 truncate">{booking.accountName}</span>
</div>
```

- [ ] **Step 3: Update test if exists**

- [ ] **Step 4: Commit**

```bash
cd apps/frontend
git add src/features/zoom-booking/components/ZoomMonthView.tsx src/features/zoom-booking/components/__tests__/ZoomMonthView.test.tsx
git commit -m "feat(month-view): show color dot + account name in booking cell"
```

---

## Task 14: Verify ZoomOverflowPopover shows account name

**Files:**
- Verify: `apps/frontend/src/features/zoom-booking/components/ZoomOverflowPopover.tsx`
- Test: `apps/frontend/src/features/zoom-booking/components/__tests__/ZoomOverflowPopover.test.tsx`

- [ ] **Step 1: Read popover file**

```bash
grep -n "accountName\|accountColorHex" apps/frontend/src/features/zoom-booking/components/ZoomOverflowPopover.tsx
```

- [ ] **Step 2: If accountName not rendered, add it**

```tsx
<div className="flex items-center gap-2">
    <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: item.accountColorHex }}
        aria-hidden="true"
    />
    <span className="text-xs font-semibold truncate">{item.accountName}</span>
    <span className="text-xs text-slate-500 truncate">· {item.title}</span>
</div>
```

- [ ] **Step 3: Run existing test**

```bash
cd apps/frontend
npm test -- ZoomOverflowPopover.test.tsx
```

- [ ] **Step 4: If test missing assertion, add one**

```typescript
it('shows account name in list item', () => {
    render(
        <ZoomOverflowPopover
            open={true}
            onClose={jest.fn()}
            onSelectBooking={jest.fn()}
            onBookSlot={jest.fn()}
            bookings={[{
                id: 'b1',
                title: 'Review',
                startTime: '10:00',
                endTime: '11:00',
                accountId: 'acc-1',
                accountName: 'Marketing',
                accountColorHex: '#f00',
                isMine: true,
            }]}
            timeRange="10:00 – 11:00"
            date="Jumat, 19 Juni 2026"
        />
    );
    expect(screen.getByText(/Marketing/i)).toBeInTheDocument();
});
```

- [ ] **Step 5: Commit**

```bash
cd apps/frontend
git add src/features/zoom-booking/components/ZoomOverflowPopover.tsx src/features/zoom-booking/components/__tests__/ZoomOverflowPopover.test.tsx
git commit -m "feat(overflow-popover): verify and show account name per item"
```

---

## Task 15: Final verification

- [ ] **Step 1: Run all backend tests**

```bash
cd apps/backend
npm test
```

Expected: all PASS.

- [ ] **Step 2: Run all frontend tests**

```bash
cd apps/frontend
npm test
```

Expected: all PASS.

- [ ] **Step 3: Backend build**

```bash
cd apps/backend
npm run build
```

- [ ] **Step 4: Frontend build**

```bash
cd apps/frontend
npm run build
```

- [ ] **Step 5: Manual smoke test**

1. Reset DB: `npm run db:reset` (or fresh migration up).
2. Start backend: `cd apps/backend && npm run start:dev`.
3. Start frontend: `cd apps/frontend && npm run dev`.
4. Open `/zoom-calendar`.
5. Verify:
   - `GET /zoom-booking/settings` returns `maxBookingPerUserPerDay: 50`, `workingDays: [0,1,2,3,4,5,6]`, `slotStartTime: '00:00'`, `slotEndTime: '23:59'`.
   - Calendar grid shows time labels 00:00 to 23:30.
   - Click Sabtu 10:00 → modal opens, save → booking created.
   - Create 2 bookings on one account → load bar shows ~13%.
   - Each booking cell shows color dot + account name truncated.
6. Admin: set `maxBookingPerUserPerDay = 500` → save → no error.
7. Admin: set `workingDays = [1,2,3,4,5]` → Sabtu/Minggu disabled again.

- [ ] **Step 6: Commit any remaining changes**

---

## Self-Review Checklist

- [ ] Spec coverage: all 5 issues addressed
- [ ] No placeholders
- [ ] Type consistency: `accountName: string` everywhere
- [ ] All tests green
- [ ] Manual smoke verified all 5 acceptance criteria

---

*End of plan.*
