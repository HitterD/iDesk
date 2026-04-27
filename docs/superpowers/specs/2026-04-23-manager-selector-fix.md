# Manager Selector Fix — Design Spec

**Date:** 2026-04-23  
**Status:** Approved  
**Scope:** Fix ManagerSelector di EformAccessCreatePage agar semua user aktif bisa muncul dan dipilih, kecuali diri sendiri

---

## Problem Statement

1. **Backend:** `GET /users/approvers` hanya return role `MANAGER` dan `ADMIN` — user biasa tidak muncul
2. **Frontend:** cmdk `CommandItem` `onSelect` tidak reliable — items muncul tapi tidak bisa diklik (sudah dicoba fix 2x, tetap gagal)
3. **Self-exclusion:** Pemohon tidak boleh memilih dirinya sendiri sebagai atasan persetujuan

---

## Architecture & Data Flow

```
Frontend (ManagerSelector)
  │  GET /users/approvers?exclude={currentUserId}
  ▼
Backend (UsersController → UsersService → UserRepo)
  │  Query: all active users WHERE id != excludeId, ORDER BY fullName ASC
  │  Relations: department
  ▼
Response: User[] { id, fullName, jobTitle, department.name }

Frontend
  └─ Popover (Radix) + plain Input + plain button list
     └─ useMemo filter: fullName/jobTitle match search string
     └─ onClick native → onSelect(id) + setOpen(false)
```

---

## Backend Changes

### `UsersController` — `GET /users/approvers`

Tambah optional query param `exclude`:

```typescript
@Get('approvers')
@UseGuards(JwtAuthGuard)
async getApprovers(@Query('exclude') excludeId?: string) {
  return this.usersService.getApprovers(excludeId);
}
```

### `UsersService` — `getApprovers(excludeId?)`

Ganti implementasi dari `find()` ke `createQueryBuilder` agar bisa exclude satu user:

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

---

## Frontend Changes

### `ManagerSelector.tsx` — Props

```typescript
interface ManagerSelectorProps {
  onSelect: (managerId: string) => void;
  selectedId?: string;
  currentUserId: string;  // baru — untuk exclude dari backend
}
```

### `ManagerSelector.tsx` — Implementation

Hapus semua cmdk (`Command`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`, `CommandEmpty`).

Ganti dengan:

```
Popover (Radix)
  └─ PopoverTrigger → Button
       └─ Jika selectedId: tampilkan fullName + jobTitle
       └─ Jika tidak: placeholder "Pilih atasan..."
  └─ PopoverContent
       └─ Input (search) — controlled state `search`
       └─ ScrollArea max-h-60
            └─ if filtered.length === 0: empty state text
            └─ filtered.map → button per user
                 onClick: onSelect(manager.id) + setOpen(false)
```

**State:**
- `open: boolean`
- `search: string`

**Data fetch:**
```typescript
const { data: managers = [] } = useQuery<Manager[]>({
  queryKey: ['users', 'approvers', currentUserId],
  queryFn: async () => {
    const { data } = await api.get(`/users/approvers?exclude=${currentUserId}`);
    return Array.isArray(data) ? data : [];
  },
});
```

**Search filter:**
```typescript
const filtered = useMemo(() =>
  managers.filter(m =>
    `${m.fullName} ${m.jobTitle ?? ''}`.toLowerCase()
      .includes(search.toLowerCase())
  ),
  [managers, search]
);
```

### `EformAccessCreatePage.tsx`

Pass `currentUserId` dari `useAuth`:

```typescript
const { user } = useAuth();
// ...
<ManagerSelector
  selectedId={managerId}
  onSelect={setManagerId}
  currentUserId={user?.id ?? ''}
/>
```

---

## Files Modified

| File | Perubahan |
|------|-----------|
| `apps/backend/src/modules/users/users.controller.ts` | Tambah `@Query('exclude')` ke `getApprovers` |
| `apps/backend/src/modules/users/users.service.ts` | Refactor `getApprovers` pakai QueryBuilder + excludeId |
| `apps/frontend/src/features/request-center/components/eform/ManagerSelector.tsx` | Hapus cmdk, ganti plain Popover + Input + button |
| `apps/frontend/src/features/request-center/pages/EformAccessCreatePage.tsx` | Pass `currentUserId` ke ManagerSelector |

---

## Success Criteria

- [ ] Semua user aktif muncul di dropdown (bukan hanya MANAGER/ADMIN)
- [ ] Diri sendiri tidak muncul di list
- [ ] Klik nama user berhasil memilih (popover tutup, nama tampil di trigger)
- [ ] Search by nama atau jabatan berfungsi
- [ ] `managerId` terkirim dengan benar saat submit form
