# Login Rate Limit Persistence & Account Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist login rate-limit countdown timers per account in `localStorage` across page refreshes and display a dual-language error message when an un-registered NIK or email is entered.

**Architecture:** Update `loginErrorMapping.ts` to map `USER_NOT_FOUND` to dual-language text (`Account not found` + `NIK atau email tidak terdaftar dalam sistem iDesk.`). In `BentoLoginPage.tsx`, use `localStorage` key `idesk_rl_<normalized_identifier>` to store and restore rate limit expiry timestamps on component load and identifier input changes.

**Tech Stack:** React 18, TypeScript, TailwindCSS, Vitest, React Testing Library.

---

### Task 1: Update `loginErrorMapping.ts` for Dual-Language `USER_NOT_FOUND` Error

**Files:**
- Modify: `apps/frontend/src/features/auth/utils/loginErrorMapping.ts`
- Modify: `apps/frontend/src/features/auth/utils/__tests__/loginErrorMapping.test.ts`

- [ ] **Step 1: Write failing test in `loginErrorMapping.test.ts`**

Update `loginErrorMapping.test.ts` to expect dual-language details for `USER_NOT_FOUND`:

```typescript
  it('maps USER_NOT_FOUND errorCode to dual-language message', () => {
    const result = getErrorFromResponse(makeAxiosErr(401, { errorCode: 'USER_NOT_FOUND' }), 0);
    expect(result).toEqual({
      type: 'error',
      message: 'Account not found',
      details: 'NIK atau email tidak terdaftar dalam sistem iDesk.',
      errorCode: 'USER_NOT_FOUND',
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run loginErrorMapping`
Expected: FAIL due to mismatched details string.

- [ ] **Step 3: Update `loginErrorMapping.ts` implementation**

In `apps/frontend/src/features/auth/utils/loginErrorMapping.ts`:
```typescript
        case 'USER_NOT_FOUND':
          return {
            type: 'error',
            message: 'Account not found',
            details: 'NIK atau email tidak terdaftar dalam sistem iDesk.',
            errorCode,
          };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run loginErrorMapping`
Expected: PASS (15 tests passing).

- [ ] **Step 5: Commit changes**

```bash
git add apps/frontend/src/features/auth/utils/loginErrorMapping.ts apps/frontend/src/features/auth/utils/__tests__/loginErrorMapping.test.ts
git commit -m "feat(auth): add dual-language details for USER_NOT_FOUND error"
```

---

### Task 2: Implement Rate Limit `localStorage` Persistence & Re-hydration in `BentoLoginPage.tsx`

**Files:**
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx`
- Modify: `apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx`

- [ ] **Step 1: Write failing test for rate limit persistence in `BentoLoginPage.integration.test.tsx`**

Add test for checking that rate limit restores from `localStorage` on page refresh/remount and email input change:

```typescript
  it('restores rate limit countdown from localStorage when page mounts or identifier changes', async () => {
    const futureExpiry = Date.now() + 45000;
    localStorage.setItem('idesk_rl_manager@idesk.com', String(futureExpiry));

    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), 'manager@idesk.com');

    expect(await screen.findByText(/rate limit exceeded/i)).toBeInTheDocument();
    expect(screen.getByText(/wait 45 seconds/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run BentoLoginPage`
Expected: FAIL because `localStorage` rate limit is not restored.

- [ ] **Step 3: Update `BentoLoginPage.tsx` to read & write `localStorage`**

Add helper functions and update `handleSubmit` & `email` change effect:

```typescript
const getStorageKey = (identifier: string) => {
    const trimmed = identifier.trim().toLowerCase();
    return trimmed ? `idesk_rl_${trimmed}` : null;
};

// Check localStorage for active rate limit whenever email input changes
useEffect(() => {
    const key = getStorageKey(email);
    if (!key) {
        setRateLimitSeconds(0);
        return;
    }
    const stored = localStorage.getItem(key);
    if (!stored) {
        setRateLimitSeconds(0);
        return;
    }
    const expiry = parseInt(stored, 10);
    if (!isNaN(expiry) && expiry > Date.now()) {
        const remaining = Math.ceil((expiry - Date.now()) / 1000);
        setRateLimitSeconds(remaining);
    } else {
        localStorage.removeItem(key);
        setRateLimitSeconds(0);
    }
}, [email]);

// Update localStorage when 429 occurs
if (axios.isAxiosError(err) && err.response?.status === 429) {
    const retryAfterHeader = err.response.headers?.['retry-after'];
    const parsedHeader = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
    const seconds = !isNaN(parsedHeader) && parsedHeader > 0 ? parsedHeader : RATE_LIMIT_WINDOW_SECONDS;
    setRateLimitSeconds(seconds);

    const key = getStorageKey(email);
    if (key) {
        localStorage.setItem(key, String(Date.now() + seconds * 1000));
    }
    setLoginError((prev) => (prev ? prev : error));
}
```

- [ ] **Step 4: Run tests to verify all tests pass**

Run: `npm run test -- --run BentoLoginPage`
Expected: PASS (all 12 tests passing).

- [ ] **Step 5: Commit changes**

```bash
git add apps/frontend/src/features/auth/pages/BentoLoginPage.tsx apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx
git commit -m "feat(auth): persist rate limit countdown per account in localStorage"
```
