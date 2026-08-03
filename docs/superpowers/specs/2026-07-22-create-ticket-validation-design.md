# Design Specification: Create Ticket Form Real-Time Validation & Error Handling

**Date:** 2026-07-22  
**Feature:** Create Ticket Form Validation & Error Handling  
**Target File:** `apps/frontend/src/features/client/pages/BentoCreateTicketPage.tsx`  

---

## 1. Executive Summary

Improve the user experience when creating tickets in `BentoCreateTicketPage.tsx` by providing clear, real-time client-side validation rules (Title ≥ 5 chars, Description ≥ 10 chars), character counters, inline field error highlighting, and clean server error parsing without duplicate toast notifications.

---

## 2. Requirements & Constraints

### 2.1 Backend Constraints (DTO)
- `title`: String, minimum **5 characters**, maximum **200 characters**.
- `description`: String, minimum **10 characters**, maximum **5000 characters**.
- `hardwareType` (for Hardware Installation): Required.
- `scheduledDate` & `scheduledTime` (for Hardware Installation): Required.

### 2.2 Frontend UX Enhancements
1. **Real-time Input Validation & Hints**:
   - For `title`: Show character count indicator (e.g. `4 / 5 min`). Highlight border in red and display an inline message if user has typed something under 5 characters: *"Subject minimal 5 karakter"*.
   - For `description`: Show character count indicator (e.g. `4 / 10 min`). Highlight border in red and display an inline message if user has typed something under 10 characters: *"Deskripsi minimal 10 karakter"*.
2. **Submit Pre-validation**:
   - Block form submit with focused inline error messages if validation fails before making network calls.
3. **Single Toast & Server Error Parsing**:
   - Parse validation errors returned from backend if server validation fails.
   - Avoid duplicate toasts by checking if the API response error was already handled or formatting the server response cleanly.

---

## 3. UI/UX Component Specifications

### 3.1 Field State & Visual Indication
- **Subject Field (`title`)**:
  - `Min Length`: 5 chars
  - `Helper Text`: Shows red error text below input when `title.length > 0 && title.length < 5`.
  - `Border Style`: `border-red-500 focus:ring-red-500` on error state.

- **Description Field (`description`)**:
  - `Min Length`: 10 chars
  - `Helper Text`: Shows red error text below input when `description.length > 0 && description.length < 10`.
  - `Border Style`: `border-red-500 focus:ring-red-500` on error state.

### 3.2 Error Handling Logic in `handleSubmit`
```typescript
if (ticketType === 'service' || ticketType === 'oracle-request') {
    if (formData.title.trim().length < 5) {
        setErrors(prev => ({ ...prev, title: 'Judul tiket minimal 5 karakter' }));
        toast.error('Judul tiket minimal 5 karakter');
        return;
    }
    if (formData.description.trim().length < 10) {
        setErrors(prev => ({ ...prev, description: 'Deskripsi tiket minimal 10 karakter' }));
        toast.error('Deskripsi tiket minimal 10 karakter');
        return;
    }
}
```

---

## 4. Verification Plan

### Automated / Type Checks
- Ensure `npx tsc --noEmit` passes with zero errors.

### Manual Verification
1. Open `/client/create`.
2. Select **Service Ticket**.
3. Type `test` into Subject field.
   - Verify red inline message *"Judul tiket minimal 5 karakter"* and red border appear.
4. Type `1234` into Description field.
   - Verify red inline message *"Deskripsi tiket minimal 10 karakter"* and red border appear.
5. Click **Submit Service Ticket**.
   - Form is blocked before sending API request, displaying clear error hint.
6. Type valid inputs (`Subject testing 123`, `Description testing 1234567890`).
   - Submit succeeds without error.
