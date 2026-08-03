# User Edit Validation Fix & Role-Based Preset Filtering Design Spec

**Date**: 2026-07-23  
**Status**: Approved  

---

## 1. Overview
Fix user editing validation failure ("Validation failed for property") and implement smart role-based permission preset filtering across the user management interfaces.

---

## 2. Issues Addressed
1. **Validation Error on User Update**:
   - Backend `UpdateUserDto` was missing `siteId`.
   - Empty string values (`""`) sent for `departmentId` or `siteId` failed NestJS `@IsUUID()` validation.
2. **Preset Filtering**:
   - Preset dropdowns allowed assigning any preset to any user role without filtering.
   - Requirement: Filter presets based on selected role using both `targetRole` property and name prefixes (`User...`, `Agent...`, `Manager...`, `Admin...`).

---

## 3. Proposed Changes

### Backend (`apps/backend/src/modules/users/dto/update-user.dto.ts`)
- Add `siteId?: string;` property with `@IsUUID()`, `@IsOptional()`.
- Add `@Transform(({ value }) => (value === '' ? null : value))` to `departmentId` and `siteId`.

### Frontend (`apps/frontend/src/features/admin/components/EditUserDialog.tsx`)
- Sanitize form submission payload by converting empty strings `""` for `departmentId` and `siteId` to `null`.
- Add `getFilteredPresets(role: string, presets: PermissionPreset[])`:
  - `USER`: `targetRole === 'USER'` OR `name.toLowerCase().startsWith('user')`
  - `AGENT*`: `targetRole === 'AGENT'` OR `name.toLowerCase().startsWith('agent')`
  - `MANAGER`: `targetRole === 'MANAGER'` OR `name.toLowerCase().startsWith('manager')`
  - `ADMIN`: `targetRole === 'ADMIN'` OR `name.toLowerCase().startsWith('admin')`
- Reset selected preset state whenever `role` dropdown value changes.

### Frontend (`apps/frontend/src/features/admin/components/agent-management/PresetDropdown.tsx`)
- Apply the same smart filtering logic to table row preset assignment dropdowns based on `user.role`.

---

## 4. Verification Plan
1. Test editing user with "No Department" and "No Site Assigned" — verify update succeeds without validation error.
2. Test role selection changes in `EditUserDialog` — verify preset dropdown shows only matching role presets.
3. Run TypeScript type check (`npx tsc -b`).
