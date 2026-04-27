# Manager Selector Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix ManagerSelector agar semua user aktif bisa dipilih sebagai atasan (kecuali diri sendiri), dengan mengganti cmdk yang bermasalah dengan plain HTML implementation.

**Architecture:** Backend menambah `?exclude` query param ke `GET /users/approvers` agar bisa filter self. Frontend mengganti cmdk `Command/CommandItem` dengan `Popover` + plain `Input` + `button` list yang 100% reliable untuk click events.

**Tech Stack:** NestJS (TypeORM QueryBuilder), React, TanStack Query, Radix UI Popover, Tailwind CSS

---

## File Map

| File | Aksi | Baris terdampak |
|------|------|-----------------|
| `apps/backend/src/modules/users/users.service.ts` | Modify | 523–532 |
| `apps/backend/src/modules/users/users.controller.ts` | Modify | 129–134 |
| `apps/frontend/src/features/request-center/components/eform/ManagerSelector.tsx` | Full rewrite | semua |
| `apps/frontend/src/features/request-center/pages/EformAccessCreatePage.tsx` | Modify | 212 |

---

## Task 1: Update `UsersService.getApprovers()` dengan QueryBuilder + excludeId

**Files:**
- Modify: `apps/backend/src/modules/users/users.service.ts:523–532`

- [ ] **Step 1: Buka file dan temukan method `getApprovers`**

  File: `apps/backend/src/modules/users/users.service.ts`, line 523.
  Method saat ini hanya return MANAGER dan ADMIN — perlu diganti dengan semua user aktif.

- [ ] **Step 2: Ganti implementasi `getApprovers`**

  Ganti blok berikut (line 523–532):
  ```typescript
  async getApprovers(): Promise<User[]> {
      return this.userRepo.find({
          where: [
              { role: UserRole.MANAGER, isActive: true },
              { role: UserRole.ADMIN, isActive: true }
          ],
          order: { fullName: 'ASC' },
          relations: ['department'],
      });
  }
  ```

  Dengan:
  ```typescript
  async getApprovers(excludeId?: string): Promise<User[]> {
      const qb = this.userRepo
          .createQueryBuilder('user')
          .leftJoinAndSelect('user.department', 'department')
          .where('user.isActive = :active', { active: true })
          .orderBy('user.fullName', 'ASC');

      if (excludeId) {
          qb.andWhere('user.id != :excludeId', { excludeId });
      }

      return qb.getMany();
  }
  ```

- [ ] **Step 3: Verifikasi TypeScript tidak error**

  ```bash
  cd apps/backend && rtk tsc --noEmit
  ```
  Expected: tidak ada error pada file `users.service.ts`

- [ ] **Step 4: Commit**

  ```bash
  rtk git add apps/backend/src/modules/users/users.service.ts
  rtk git commit -m "feat: update getApprovers to return all active users with optional self-exclude"
  ```

---

## Task 2: Update `UsersController.getApprovers()` dengan query param `exclude`

**Files:**
- Modify: `apps/backend/src/modules/users/users.controller.ts:129–134`

- [ ] **Step 1: Temukan method `getApprovers` di controller**

  File: `apps/backend/src/modules/users/users.controller.ts`, line 129–134.
  Method saat ini:
  ```typescript
  @Get('approvers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all users available for approval roles' })
  async getApprovers() {
      return this.usersService.getApprovers();
  }
  ```

- [ ] **Step 2: Tambah `@Query('exclude')` dan pass ke service**

  Ganti dengan:
  ```typescript
  @Get('approvers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all active users for approval selection, optionally excluding a user by ID' })
  @ApiQuery({ name: 'exclude', required: false, description: 'User ID to exclude (e.g. current requester)' })
  async getApprovers(@Query('exclude') excludeId?: string) {
      return this.usersService.getApprovers(excludeId);
  }
  ```

  Pastikan import `ApiQuery` sudah ada di baris import (line 28):
  ```typescript
  import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
  ```
  (`ApiQuery` sudah ada — tidak perlu tambah import baru)

- [ ] **Step 3: Verifikasi TypeScript tidak error**

  ```bash
  cd apps/backend && rtk tsc --noEmit
  ```
  Expected: tidak ada error

- [ ] **Step 4: Test endpoint manual**

  Pastikan backend berjalan, lalu test dengan curl atau browser:
  ```bash
  # Semua user aktif (tanpa exclude)
  curl -H "Authorization: Bearer <token>" http://localhost:3000/users/approvers

  # Exclude user tertentu
  curl -H "Authorization: Bearer <token>" "http://localhost:3000/users/approvers?exclude=<userId>"
  ```
  Expected: array JSON berisi semua user aktif. Dengan `?exclude=<userId>`, user tersebut tidak ada di list.

- [ ] **Step 5: Commit**

  ```bash
  rtk git add apps/backend/src/modules/users/users.controller.ts
  rtk git commit -m "feat: add exclude query param to GET /users/approvers"
  ```

---

## Task 3: Rewrite `ManagerSelector.tsx` — hapus cmdk, ganti plain implementation

**Files:**
- Rewrite: `apps/frontend/src/features/request-center/components/eform/ManagerSelector.tsx`

- [ ] **Step 1: Ganti seluruh isi file dengan implementasi baru**

  ```typescript
  import React, { useState, useMemo } from 'react';
  import { useQuery } from '@tanstack/react-query';
  import { Check, ChevronsUpDown, User } from 'lucide-react';
  import { cn } from '@/lib/utils';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from '@/components/ui/popover';
  import api from '@/lib/api';

  interface Manager {
    id: string;
    fullName: string;
    jobTitle: string;
    department?: {
      name: string;
    };
  }

  interface ManagerSelectorProps {
    onSelect: (managerId: string) => void;
    selectedId?: string;
    currentUserId: string;
  }

  export const ManagerSelector: React.FC<ManagerSelectorProps> = ({
    onSelect,
    selectedId,
    currentUserId,
  }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const { data: managers = [], isLoading } = useQuery<Manager[]>({
      queryKey: ['users', 'approvers', currentUserId],
      queryFn: async () => {
        const { data } = await api.get(`/users/approvers?exclude=${currentUserId}`);
        return Array.isArray(data) ? data : [];
      },
      enabled: !!currentUserId,
    });

    const filtered = useMemo(
      () =>
        managers.filter(m =>
          `${m.fullName} ${m.jobTitle ?? ''}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        ),
      [managers, search],
    );

    const selectedManager = managers.find(m => m.id === selectedId);

    return (
      <div className="space-y-2">
        <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60 flex items-center gap-2">
          <User size={12} className="text-primary" />
          Pilih Atasan Persetujuan
        </label>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between rounded-xl border-border/50 h-11 px-4 hover:border-primary/30 transition-colors duration-150"
            >
              {selectedManager ? (
                <div className="flex flex-col items-start overflow-hidden">
                  <span className="text-sm font-bold truncate w-full text-left">
                    {selectedManager.fullName}
                  </span>
                  <span className="text-[10px] opacity-60 truncate w-full text-left font-medium">
                    {selectedManager.jobTitle}
                    {selectedManager.department?.name
                      ? ` • ${selectedManager.department.name}`
                      : ''}
                  </span>
                </div>
              ) : (
                <span className="text-sm opacity-60">Pilih atasan...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 rounded-2xl border-border/40 shadow-2xl">
            <Input
              placeholder="Cari nama atau jabatan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 mb-2 rounded-xl"
              autoFocus
            />

            <div className="overflow-y-auto max-h-60">
              {isLoading && (
                <p className="text-xs text-center opacity-50 py-4">Memuat...</p>
              )}
              {!isLoading && filtered.length === 0 && (
                <p className="text-xs text-center opacity-50 py-4">
                  Tidak ditemukan.
                </p>
              )}
              {filtered.map(manager => (
                <button
                  key={manager.id}
                  type="button"
                  onClick={() => {
                    onSelect(manager.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors text-left"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary shrink-0">
                    <User size={16} />
                  </div>
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <span className="text-sm font-bold">{manager.fullName}</span>
                    <span className="text-[10px] opacity-60 font-medium">
                      {manager.jobTitle}
                      {manager.department?.name
                        ? ` • ${manager.department.name}`
                        : ''}
                    </span>
                  </div>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4 text-primary',
                      selectedId === manager.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };
  ```

- [ ] **Step 2: Verifikasi TypeScript tidak error**

  ```bash
  cd apps/frontend && rtk tsc --noEmit
  ```
  Expected: tidak ada error pada `ManagerSelector.tsx`

- [ ] **Step 3: Commit**

  ```bash
  rtk git add apps/frontend/src/features/request-center/components/eform/ManagerSelector.tsx
  rtk git commit -m "feat: replace cmdk with plain Popover+button in ManagerSelector"
  ```

---

## Task 4: Update `EformAccessCreatePage.tsx` — pass `currentUserId`

**Files:**
- Modify: `apps/frontend/src/features/request-center/pages/EformAccessCreatePage.tsx:212`

- [ ] **Step 1: Temukan usage `ManagerSelector` dan tambah prop `currentUserId`**

  Line 212 saat ini:
  ```typescript
  <ManagerSelector selectedId={managerId} onSelect={setManagerId} />
  ```

  `user` dari `useAuth` sudah ada di line 23: `const { user } = useAuth();`

  Ganti dengan:
  ```typescript
  <ManagerSelector
    selectedId={managerId}
    onSelect={setManagerId}
    currentUserId={user?.id ?? ''}
  />
  ```

- [ ] **Step 2: Verifikasi TypeScript tidak error**

  ```bash
  cd apps/frontend && rtk tsc --noEmit
  ```
  Expected: tidak ada error

- [ ] **Step 3: Commit**

  ```bash
  rtk git add apps/frontend/src/features/request-center/pages/EformAccessCreatePage.tsx
  rtk git commit -m "feat: pass currentUserId to ManagerSelector for self-exclusion"
  ```

---

## Task 5: Verifikasi End-to-End

- [ ] **Step 1: Jalankan backend dan frontend**

  ```bash
  # Terminal 1 — backend
  cd apps/backend && npm run start:dev

  # Terminal 2 — frontend
  cd apps/frontend && npm run dev
  ```

- [ ] **Step 2: Login sebagai user biasa (bukan admin)**

  Buka browser → login dengan akun user biasa (misalnya user.spj atau jason).

- [ ] **Step 3: Buka halaman E-Form Access Request**

  Navigasi ke halaman form pengajuan akses.

- [ ] **Step 4: Cek dropdown atasan**

  Klik field "Pilih Atasan Persetujuan":
  - ✅ Semua user aktif muncul (bukan hanya MANAGER/ADMIN)
  - ✅ Diri sendiri tidak ada di list
  - ✅ Klik nama user → popover tutup, nama tampil di trigger button
  - ✅ Search "jason" → user jason muncul dan bisa dipilih

- [ ] **Step 5: Submit form**

  Lengkapi field lainnya dan submit. Verifikasi request berhasil terkirim dengan `managerId` yang benar.

---

## Success Criteria

- [ ] Semua user aktif muncul di dropdown (termasuk role USER biasa)
- [ ] Diri sendiri tidak muncul di list
- [ ] Klik nama user berhasil memilih (popover tutup, nama tampil di trigger)
- [ ] Search by nama atau jabatan berfungsi
- [ ] `managerId` terkirim dengan benar saat submit form
