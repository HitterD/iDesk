# Wajib Ganti Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paksa user dengan password `123456` atau baru pertama kali login untuk mengganti password lewat popup non-dismissible saat login.

**Architecture:** Kolom flag `mustChangePassword` di entity `User` sebagai satu sumber kebenaran. Migration menandai user existing ber-password `123456`. Empat jalur create/reset menandai `true`. Login mengirim flag ke frontend; popup non-dismissible me-reuse endpoint `POST /auth/change-password` yang ada, lalu meng-clear flag. Enforcement frontend-only (tanpa backend hard-block).

**Tech Stack:** NestJS + TypeORM (PostgreSQL), bcrypt, Jest (backend); React + Zustand + TanStack Query + axios, Vitest/RTL (frontend).

## Global Constraints

- Password baru: **min 8 karakter**, **tidak boleh `123456`**, harus sama dengan konfirmasi.
- Reuse endpoint `POST /auth/change-password` (body `{ currentPassword, newPassword }`) — TIDAK buat endpoint baru.
- Enforcement **frontend-only**: TIDAK ada backend guard/hard-block.
- User NIK/HRIS tanpa password lokal di luar cakupan (auth via HRIS gateway).
- Nilai `BCRYPT_ROUNDS` dari `apps/backend/src/shared/core/config/security.config.ts` — jangan hardcode.
- Bahasa output UI mengikuti pola existing (campuran EN label + ID detail), lihat `BentoLoginPage.tsx`.

---

### Task 1: Tambah kolom `mustChangePassword` di entity User

**Files:**
- Modify: `apps/backend/src/modules/users/entities/user.entity.ts` (setelah blok `lastActiveAt`, sekitar baris 74)

**Interfaces:**
- Produces: field `User.mustChangePassword: boolean` (default `false`).

- [ ] **Step 1: Tambah kolom di entity**

Di `user.entity.ts`, setelah properti `lastActiveAt` (baris 73-74), sisipkan:

```ts
    // Wajib ganti password saat login (default 123456 / first login / reset admin)
    @Column({ default: false })
    mustChangePassword: boolean;
```

- [ ] **Step 2: Verifikasi build TypeScript**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: PASS (tanpa error terkait user.entity.ts).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/users/entities/user.entity.ts
git commit -m "feat(users): add mustChangePassword column to User entity"
```

---

### Task 2: Migration — tambah kolom + tandai user password 123456

**Files:**
- Create: `apps/backend/src/migrations/1784600000000-AddMustChangePassword.ts`

**Interfaces:**
- Consumes: kolom `mustChangePassword` dari Task 1.
- Produces: migration class `AddMustChangePassword1784600000000`.

Pola migration mengikuti `apps/backend/src/migrations/1777500000000-AddInstallUserConfirmation.ts` (pakai `qr.query`, `IF NOT EXISTS`). Import `bcrypt` untuk compare `123456`.

- [ ] **Step 1: Tulis migration**

Buat `apps/backend/src/migrations/1784600000000-AddMustChangePassword.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class AddMustChangePassword1784600000000 implements MigrationInterface {
    public async up(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false`,
        );

        // Tandai semua user yang password lokalnya masih "123456".
        // bcrypt tidak bisa di-compare via SQL, jadi ambil user ber-password
        // lalu compare per baris.
        const users: Array<{ id: string; password: string | null }> = await qr.query(
            `SELECT "id", "password" FROM "users" WHERE "password" IS NOT NULL`,
        );

        const matchedIds: string[] = [];
        for (const u of users) {
            if (u.password && (await bcrypt.compare('123456', u.password))) {
                matchedIds.push(u.id);
            }
        }

        if (matchedIds.length > 0) {
            // Update batch via ANY($1) — satu round-trip.
            await qr.query(
                `UPDATE "users" SET "mustChangePassword" = true WHERE "id" = ANY($1)`,
                [matchedIds],
            );
        }
    }

    public async down(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TABLE "users" DROP COLUMN IF EXISTS "mustChangePassword"`,
        );
    }
}
```

- [ ] **Step 2: Verifikasi build TypeScript**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Jalankan migration ke DB dev**

Run: `cd apps/backend && npm run migration:run` (atau perintah migration yang ada di `package.json`; cek `grep migration apps/backend/package.json` bila nama berbeda)
Expected: migration `AddMustChangePassword1784600000000` sukses; kolom `mustChangePassword` ada di tabel `users`. Bila tak ada DB dev, lewati dan catat untuk dijalankan di deploy.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/migrations/1784600000000-AddMustChangePassword.ts
git commit -m "feat(users): migration add mustChangePassword + flag legacy 123456 users"
```

---

### Task 3: Set flag `true` di createUser & createAgent

**Files:**
- Modify: `apps/backend/src/modules/users/user-crud.service.ts` (createAgent ~baris 52, createUser ~baris 204)
- Test: `apps/backend/src/modules/users/user-crud.service.hris.spec.ts` (atau spec create existing bila ada)

**Interfaces:**
- Consumes: field `mustChangePassword` (Task 1).
- Produces: user hasil `createUser`/`createAgent` punya `mustChangePassword: true`.

- [ ] **Step 1: Tulis failing test**

Tambah ke `apps/backend/src/modules/users/user-crud.service.hris.spec.ts` (di dalam `describe` yang sudah ada, atau buat `describe('mustChangePassword on create')`). Sesuaikan mock repo dengan pola yang sudah ada di file itu:

```ts
it('createUser menandai mustChangePassword true', async () => {
    // arrange: mock userRepo.findOne -> null (email unik), create/save echo balik
    const created: any = {};
    (service as any).userRepo.create = jest.fn((v: any) => { Object.assign(created, v); return created; });
    (service as any).userRepo.save = jest.fn(async (v: any) => ({ id: 'u1', ...v }));
    (service as any).userRepo.findOne = jest.fn(async () => null);

    await service.createUser({ email: 'a@b.com', fullName: 'A', role: 'USER' } as any);

    expect(created.mustChangePassword).toBe(true);
});
```

- [ ] **Step 2: Run test — verify FAIL**

Run: `cd apps/backend && npx jest user-crud.service.hris -t "mustChangePassword true"`
Expected: FAIL (`created.mustChangePassword` undefined).

- [ ] **Step 3: Implementasi**

Di `user-crud.service.ts`, dalam `createUser`, objek `this.userRepo.create({ ... })` (baris ~204) tambah:

```ts
            mustChangePassword: true,
```

Dalam `createAgent`, objek `this.userRepo.create({ ...dto, password: hashedPassword, role: UserRole.AGENT })` (baris ~52) ubah jadi menambah `mustChangePassword: true`:

```ts
        const user = this.userRepo.create({
            ...dto,
            password: hashedPassword,
            role: UserRole.AGENT,
            mustChangePassword: true,
        });
```

- [ ] **Step 4: Run test — verify PASS**

Run: `cd apps/backend && npx jest user-crud.service.hris -t "mustChangePassword true"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/users/user-crud.service.ts apps/backend/src/modules/users/user-crud.service.hris.spec.ts
git commit -m "feat(users): set mustChangePassword on createUser and createAgent"
```

---

### Task 4: Set flag `true` di importUsers (create branch)

**Files:**
- Modify: `apps/backend/src/modules/users/user-import.service.ts` (create branch, `this.userRepo.create({ ... })` ~baris 185-196)

**Interfaces:**
- Consumes: field `mustChangePassword` (Task 1).
- Produces: user baru hasil import punya `mustChangePassword: true`. (Upsert branch TIDAK diubah — user existing tak dipaksa.)

- [ ] **Step 1: Implementasi**

Di `user-import.service.ts`, pada branch `else if (!existingUser)`, objek `this.userRepo.create({ ... })` (baris ~185) tambah field:

```ts
                            password: hashedPassword,
                            mustChangePassword: true,
```

(sisipkan `mustChangePassword: true` tepat setelah `password: hashedPassword,`).

- [ ] **Step 2: Verifikasi build TypeScript**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/users/user-import.service.ts
git commit -m "feat(users): set mustChangePassword on imported new users"
```

---

### Task 5: Set flag `true` di resetPassword

**Files:**
- Modify: `apps/backend/src/modules/users/user-password.service.ts` (`resetPassword`, `userRepo.update` ~baris 78)
- Test: `apps/backend/src/modules/users/user-crud.service.hris.spec.ts` atau spec password existing

**Interfaces:**
- Consumes: field `mustChangePassword` (Task 1).
- Produces: `resetPassword` menyetel `mustChangePassword: true` bersama update password.

- [ ] **Step 1: Tulis failing test**

Tambah test (pada spec yang meng-cover `UserPasswordService`, atau buat `user-password.service.spec.ts` minimal dgn mock `userRepo` + `auditService`):

```ts
it('resetPassword menandai mustChangePassword true', async () => {
    const update = jest.fn(async () => ({}));
    (service as any).userRepo.findOne = jest.fn(async () => ({ id: 'u1', fullName: 'A', role: 'USER' }));
    (service as any).userRepo.update = update;

    await service.resetPassword('u1', 'temp-pass-123', 'admin', 'ADMIN');

    expect(update).toHaveBeenCalledWith('u1', expect.objectContaining({ mustChangePassword: true }));
});
```

- [ ] **Step 2: Run test — verify FAIL**

Run: `cd apps/backend && npx jest user-password -t "resetPassword menandai"`
Expected: FAIL (update dipanggil hanya dengan `{ password }`).

- [ ] **Step 3: Implementasi**

Di `user-password.service.ts` `resetPassword`, ubah baris `await this.userRepo.update(userId, { password: hashedPassword });` (baris ~78) jadi:

```ts
        await this.userRepo.update(userId, { password: hashedPassword, mustChangePassword: true });
```

- [ ] **Step 4: Run test — verify PASS**

Run: `cd apps/backend && npx jest user-password -t "resetPassword menandai"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/users/user-password.service.ts apps/backend/src/modules/users/*.spec.ts
git commit -m "feat(users): set mustChangePassword on admin resetPassword"
```

---

### Task 6: Clear flag saat changePassword

**Files:**
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts` (`changePassword` ~baris 42-43)
- Test: `apps/backend/src/modules/auth/application/auth.service.spec.ts` (describe `changePassword` ~baris 201)

**Interfaces:**
- Consumes: field `mustChangePassword` (Task 1); `usersService.update(userId, partial)` (sudah ada, delegasi ke `userCrudService.update`).
- Produces: setelah ganti password sukses, `mustChangePassword` user di-set `false`.

- [ ] **Step 1: Tulis failing test**

Di `auth.service.spec.ts`, dalam `describe('changePassword')`, tambah test (mock `usersService.update` sudah tersedia di provider, baris 38). Sesuaikan `mockUser` bila perlu:

```ts
it('meng-clear mustChangePassword setelah sukses', async () => {
    usersService.findById.mockResolvedValue(mockUser as any);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('newHash');
    usersService.updatePassword.mockResolvedValue(undefined);

    await service.changePassword(mockUser.id, {
        currentPassword: 'correctpassword',
        newPassword: 'newpassword8',
    } as any);

    expect(usersService.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ mustChangePassword: false }),
    );
});
```

- [ ] **Step 2: Run test — verify FAIL**

Run: `cd apps/backend && npx jest auth.service.spec -t "meng-clear mustChangePassword"`
Expected: FAIL (`usersService.update` tidak dipanggil).

- [ ] **Step 3: Implementasi**

Di `auth.service.ts` `changePassword`, setelah `await this.usersService.updatePassword(userId, newPasswordHash);` (baris 43) tambah:

```ts
        await this.usersService.updatePassword(userId, newPasswordHash);
        await this.usersService.update(userId, { mustChangePassword: false });
```

- [ ] **Step 4: Run test — verify PASS**

Run: `cd apps/backend && npx jest auth.service.spec -t "meng-clear mustChangePassword"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/auth/application/auth.service.ts apps/backend/src/modules/auth/application/auth.service.spec.ts
git commit -m "feat(auth): clear mustChangePassword after password change"
```

---

### Task 7: Login mengirim flag `mustChangePassword`

**Files:**
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts` (`login` payload/`user` return ~baris 208-238)
- Test: `apps/backend/src/modules/auth/application/auth.service.spec.ts`

**Interfaces:**
- Consumes: field `mustChangePassword` di objek user.
- Produces: response `login` menyertakan `user.mustChangePassword`.

**Catatan:** `validateUserWithDetails`/`validateNikUser` sudah `const { password, ...result } = user`, jadi `mustChangePassword` otomatis ikut selama kolom ada di entity. Verifikasi via test bahwa flag ter-teruskan ke `login` result.

- [ ] **Step 1: Tulis failing test**

Di `auth.service.spec.ts`, di `describe('login')` (cari yang sudah ada; jika tidak ada, buat baru):

```ts
it('login meneruskan mustChangePassword ke response', async () => {
    jwtService.sign.mockReturnValue('token');
    usersService.update.mockResolvedValue({} as any);
    usersService.setCurrentRefreshToken = jest.fn();

    const result = await service.login({
        id: 'u1', email: 'a@b.com', role: 'USER', fullName: 'A', mustChangePassword: true,
    } as any);

    expect(result.user.mustChangePassword).toBe(true);
});
```

- [ ] **Step 2: Run test — verify hasil**

Run: `cd apps/backend && npx jest auth.service.spec -t "meneruskan mustChangePassword"`
Expected: PASS langsung bila `login` mengembalikan `user: user` apa adanya (baris 236). Jika `login` melakukan pick field terbatas, FAIL → lanjut Step 3.

- [ ] **Step 3: Implementasi (bila perlu)**

`login` (baris 236) sudah `return { ..., user: user }` — objek user diteruskan utuh, jadi flag ikut. Bila test Step 2 sudah PASS, tidak ada perubahan kode; task ini murni regression guard. Bila FAIL, pastikan objek `user` yang dikembalikan menyertakan `mustChangePassword`.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/auth/application/auth.service.spec.ts
git commit -m "test(auth): guard login forwards mustChangePassword flag"
```

---

### Task 8: Tambah `mustChangePassword` di frontend User type

**Files:**
- Modify: `apps/frontend/src/stores/useAuth.ts` (interface `User` ~baris 6-17)

**Interfaces:**
- Produces: `User.mustChangePassword?: boolean` tersedia untuk komponen.

- [ ] **Step 1: Tambah field**

Di `useAuth.ts` interface `User`, setelah `siteId?: string;` (baris 16) tambah:

```ts
    mustChangePassword?: boolean;
```

- [ ] **Step 2: Verifikasi build**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/stores/useAuth.ts
git commit -m "feat(auth): add mustChangePassword to frontend User type"
```

---

### Task 9: Komponen MustChangePasswordDialog

**Files:**
- Create: `apps/frontend/src/features/auth/components/MustChangePasswordDialog.tsx`
- Test: `apps/frontend/src/features/auth/components/__tests__/MustChangePasswordDialog.test.tsx`

**Interfaces:**
- Consumes: `api` dari `@/lib/api`; endpoint `POST /auth/change-password` body `{ currentPassword, newPassword }`.
- Produces: komponen `MustChangePasswordDialog` dengan props:
  ```ts
  interface MustChangePasswordDialogProps {
      currentPassword: string;        // auto-fill dari password login
      onSuccess: () => void;          // dipanggil setelah ganti sukses
  }
  ```
  Non-dismissible: tanpa X, tanpa Cancel, overlay klik tidak menutup.

- [ ] **Step 1: Tulis failing test**

Buat `apps/frontend/src/features/auth/components/__tests__/MustChangePasswordDialog.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MustChangePasswordDialog } from '../MustChangePasswordDialog';
import api from '@/lib/api';

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }));

describe('MustChangePasswordDialog', () => {
    beforeEach(() => vi.clearAllMocks());

    const setup = (props = {}) =>
        render(<MustChangePasswordDialog currentPassword="123456" onSuccess={vi.fn()} {...props} />);

    it('menolak password 123456', async () => {
        setup();
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: '123456' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        expect(await screen.findByText(/tidak boleh 123456/i)).toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
    });

    it('menolak konfirmasi tidak cocok', async () => {
        setup();
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: 'newpass88' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: 'different8' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        expect(await screen.findByText(/tidak cocok/i)).toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
    });

    it('menolak kurang dari 8 karakter', async () => {
        setup();
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: 'short7x' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: 'short7x' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        expect(await screen.findByText(/minimal 8/i)).toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
    });

    it('submit valid memanggil api dengan currentPassword auto-fill lalu onSuccess', async () => {
        (api.post as any).mockResolvedValue({ data: {} });
        const onSuccess = vi.fn();
        setup({ onSuccess });
        fireEvent.change(screen.getByLabelText(/password baru/i), { target: { value: 'newpass88' } });
        fireEvent.change(screen.getByLabelText(/konfirmasi/i), { target: { value: 'newpass88' } });
        fireEvent.click(screen.getByRole('button', { name: /simpan|ganti/i }));
        await waitFor(() =>
            expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
                currentPassword: '123456',
                newPassword: 'newpass88',
            }),
        );
        await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    });
});
```

- [ ] **Step 2: Run test — verify FAIL**

Run: `cd apps/frontend && npx vitest run MustChangePasswordDialog`
Expected: FAIL (komponen belum ada).

- [ ] **Step 3: Implementasi komponen**

Buat `apps/frontend/src/features/auth/components/MustChangePasswordDialog.tsx`. Ikuti gaya modal `ResetPasswordDialog.tsx` (className Tailwind), tapi non-dismissible:

```tsx
import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface MustChangePasswordDialogProps {
    currentPassword: string;
    onSuccess: () => void;
}

export const MustChangePasswordDialog: React.FC<MustChangePasswordDialogProps> = ({ currentPassword, onSuccess }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const validate = (): string | null => {
        if (newPassword.length < 8) return 'Password minimal 8 karakter.';
        if (newPassword === '123456') return 'Password baru tidak boleh 123456.';
        if (newPassword !== confirm) return 'Konfirmasi password tidak cocok.';
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const v = validate();
        if (v) { setError(v); return; }
        setError(null);
        setSubmitting(true);
        try {
            await api.post('/auth/change-password', { currentPassword, newPassword });
            toast.success('Password berhasil diganti');
            onSuccess();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Gagal mengganti password.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                        <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Wajib Ganti Password</h2>
                        <p className="text-sm text-slate-500">Demi keamanan, ganti password Anda sebelum lanjut.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="mcp-new" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Password Baru
                        </label>
                        <div className="relative">
                            <input
                                id="mcp-new"
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                tabIndex={-1}
                                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Minimal 8 karakter, tidak boleh 123456.</p>
                    </div>

                    <div>
                        <label htmlFor="mcp-confirm" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Konfirmasi Password Baru
                        </label>
                        <input
                            id="mcp-confirm"
                            type={showPassword ? 'text' : 'password'}
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || !newPassword || !confirm}
                        className="w-full px-4 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Menyimpan...' : 'Simpan Password Baru'}
                    </button>
                </form>
            </div>
        </div>
    );
};
```

- [ ] **Step 4: Run test — verify PASS**

Run: `cd apps/frontend && npx vitest run MustChangePasswordDialog`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/auth/components/MustChangePasswordDialog.tsx apps/frontend/src/features/auth/components/__tests__/MustChangePasswordDialog.test.tsx
git commit -m "feat(auth): add MustChangePasswordDialog component"
```

---

### Task 10: Integrasi dialog di BentoLoginPage

**Files:**
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx` (import, state, `handleSubmit` ~baris 80-105, render ~baris 114)

**Interfaces:**
- Consumes: `MustChangePasswordDialog` (Task 9), `User.mustChangePassword` (Task 8).
- Produces: alur — login sukses + `mustChangePassword` → tampilkan dialog alih-alih navigate; setelah sukses ganti → `updateUser({ mustChangePassword: false })` + navigate sesuai role.

- [ ] **Step 1: Refactor routing role ke fungsi reusable**

Di `BentoLoginPage.tsx`, ekstrak logika navigate role (baris 86-94) jadi fungsi `navigateByRole` di dalam komponen (di atas `handleSubmit`):

```tsx
    const navigateByRole = useCallback((role: string) => {
        if (role === 'AGENT_ORACLE') navigate('/tickets/oracle-k2');
        else if (DASHBOARD_ROLES.has(role)) navigate('/dashboard');
        else if (role === 'MANAGER') navigate('/manager/dashboard');
        else navigate('/client/my-tickets');
    }, [navigate]);
```

- [ ] **Step 2: Tambah state + import**

Tambah import di baris 6-area:

```tsx
import { MustChangePasswordDialog } from '../components/MustChangePasswordDialog';
```

Tambah dari store `updateUser` (baris 23-area):

```tsx
    const login = useAuth((state) => state.login);
    const updateUser = useAuth((state) => state.updateUser);
```

Tambah state (baris 21-area):

```tsx
    const [mustChange, setMustChange] = useState<{ role: string } | null>(null);
```

- [ ] **Step 3: Ubah handleSubmit success branch**

Ganti blok setelah `login(user);` (baris 84-94) jadi:

```tsx
            setFailedAttempts(0);
            login(user);

            if (user.mustChangePassword) {
                setMustChange({ role: user.role });
                return; // jangan navigate; tampilkan dialog
            }

            navigateByRole(user.role);
```

- [ ] **Step 4: Render dialog**

Sebelum penutup `</div>` root render (setelah `<footer>`, sekitar baris 308), tambah:

```tsx
            {mustChange && (
                <MustChangePasswordDialog
                    currentPassword={password}
                    onSuccess={() => {
                        updateUser({ mustChangePassword: false });
                        setMustChange(null);
                        navigateByRole(mustChange.role);
                    }}
                />
            )}
```

- [ ] **Step 5: Verifikasi build + test existing login**

Run: `cd apps/frontend && npx tsc --noEmit && npx vitest run BentoLoginPage`
Expected: PASS (tidak memecah test login existing).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/auth/pages/BentoLoginPage.tsx
git commit -m "feat(auth): show must-change-password dialog on login when flag set"
```

---

### Task 11: Verifikasi end-to-end + full test suite

**Files:** (tidak ada perubahan kode; verifikasi)

- [ ] **Step 1: Backend test suite (modul auth + users)**

Run: `cd apps/backend && npx jest auth users`
Expected: PASS semua.

- [ ] **Step 2: Frontend test suite (auth)**

Run: `cd apps/frontend && npx vitest run auth`
Expected: PASS semua.

- [ ] **Step 3: Smoke manual (opsional, bila DB dev tersedia)**

1. Login user dengan password `123456` → dialog wajib-ganti muncul, tak bisa ditutup.
2. Coba password `123456` → error "tidak boleh 123456".
3. Ganti ke password valid 8+ char → sukses, redirect sesuai role.
4. Logout, login ulang dengan password baru → tidak ada dialog (flag ter-clear).

- [ ] **Step 4: Commit (bila ada perbaikan)**

```bash
git add -A
git commit -m "test: verify must-change-password end-to-end"
```

---

## Self-Review Notes

- **Spec coverage:** data model (T1), migration+flag legacy (T2), 4 jalur set true — createUser/createAgent (T3), import (T4), reset (T5); clear saat change (T6); login kirim flag (T7); frontend type (T8), dialog (T9), integrasi login (T10); testing (T3,5,6,7,9,11). Semua bagian spec ter-cover.
- **Enforcement frontend-only:** tidak ada task guard backend — sesuai spec.
- **Type consistency:** `mustChangePassword: boolean` konsisten backend entity & frontend `User` type; props dialog `currentPassword`/`onSuccess` konsisten antara T9 & T10; `navigateByRole(role: string)` didefinisikan T10 Step 1, dipakai T10 Step 3 & 4.
- **Reuse:** endpoint change-password, `usersService.update`, gaya modal `ResetPasswordDialog` — tanpa endpoint/dependency baru.
