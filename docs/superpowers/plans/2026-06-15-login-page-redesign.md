# Login Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `BentoLoginPage.tsx` with an editorial-restraint, dark-primary, animated design that matches iDesk inner pages, while preserving all existing authentication behavior (error mapping, caps lock, online/offline, rate limit, role-based redirect).

**Architecture:** Extract the testable error-mapping function to its own module. Add new CSS variables (grid, glows, vignette) to the design tokens. Rewrite the React component to use the new design system: layered background, framed card with corner ticks, functional animations, theme-aware. Delete the orphaned `LoginPage.tsx`. Add tests for both the pure logic and the component.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide React, Vitest + React Testing Library, Google Fonts (Plus Jakarta Sans, JetBrains Mono — already loaded by `apps/frontend/index.html`).

**Spec reference:** `docs/superpowers/specs/2026-06-15-login-page-redesign-design.md`
**Visual companion:** `mockups/login-mockup.html`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/frontend/src/features/auth/utils/loginErrorMapping.ts` | Create | Pure function `getErrorFromResponse` + `LoginError` type |
| `apps/frontend/src/features/auth/utils/__tests__/loginErrorMapping.test.ts` | Create | Unit tests for error mapper |
| `apps/frontend/src/hooks/useTheme.ts` | Create (if not exists) | Theme state + localStorage persistence |
| `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx` | Modify (full rewrite) | The login page component |
| `apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.test.tsx` | Create | Smoke test |
| `apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx` | Create | State machine integration test |
| `apps/frontend/src/features/auth/pages/LoginPage.tsx` | Delete | Orphaned, not routed anywhere |
| `apps/frontend/src/styles/tokens.css` | Modify | Add `--grid-line`, `--grid-size`, `--glow-1`, `--glow-2`, `--vignette` to both themes |
| `apps/frontend/src/index.css` | Modify | Apply 5-layer background to `body`; add page-reveal keyframes; add reduced-motion media query |

---

### Task 1: Extract `getErrorFromResponse` to a pure module (TDD)

**Files:**
- Create: `apps/frontend/src/features/auth/utils/loginErrorMapping.ts`
- Create: `apps/frontend/src/features/auth/utils/__tests__/loginErrorMapping.test.ts`
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/frontend/src/features/auth/utils/__tests__/loginErrorMapping.test.ts
import { describe, it, expect } from 'vitest';
import { getErrorFromResponse } from '../loginErrorMapping';

const makeAxiosErr = (status: number | undefined, data: any = {}) => ({
  isAxiosError: true,
  response: status ? { status, data } : undefined,
  message: 'mocked',
});

describe('getErrorFromResponse', () => {
  it('returns "Unable to connect to server" when no response', () => {
    const result = getErrorFromResponse(makeAxiosErr(undefined), 0);
    expect(result.message).toBe('Unable to connect to server');
    expect(result.type).toBe('error');
  });

  it('maps USER_NOT_FOUND errorCode', () => {
    const result = getErrorFromResponse(makeAxiosErr(401, { errorCode: 'USER_NOT_FOUND' }), 0);
    expect(result.message).toBe('Account not found');
    expect(result.errorCode).toBe('USER_NOT_FOUND');
  });

  it('maps WRONG_PASSWORD with attempts remaining', () => {
    const result = getErrorFromResponse(makeAxiosErr(401, { errorCode: 'WRONG_PASSWORD' }), 2);
    expect(result.message).toBe('Incorrect password');
    expect(result.details).toContain('2 attempt');
  });

  it('maps WRONG_PASSWORD last attempt', () => {
    const result = getErrorFromResponse(makeAxiosErr(401, { errorCode: 'WRONG_PASSWORD' }), 4);
    expect(result.details).toContain('last attempt');
  });

  it('maps ACCOUNT_DISABLED', () => {
    const result = getErrorFromResponse(makeAxiosErr(401, { errorCode: 'ACCOUNT_DISABLED' }), 0);
    expect(result.message).toBe('Account suspended');
  });

  it('maps 423 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(423, { message: 'Locked' }), 0);
    expect(result.message).toBe('Security lock active');
  });

  it('maps 429 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(429, {}), 0);
    expect(result.message).toBe('Rate limit exceeded');
  });

  it('maps 500 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(500, {}), 0);
    expect(result.message).toBe('Server unavailable');
  });

  it('maps 502 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(502, {}), 0);
    expect(result.message).toBe('Server unavailable');
  });

  it('maps 503 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(503, {}), 0);
    expect(result.message).toBe('Server unavailable');
  });

  it('maps 400 with array message', () => {
    const result = getErrorFromResponse(makeAxiosErr(400, { message: ['field1', 'field2'] }), 0);
    expect(result.details).toBe('field1, field2');
  });

  it('maps 401 with custom message', () => {
    const result = getErrorFromResponse(makeAxiosErr(401, { message: 'Token expired' }), 0);
    expect(result.message).toBe('Token expired');
  });

  it('maps 403 status', () => {
    const result = getErrorFromResponse(makeAxiosErr(403, {}), 0);
    expect(result.message).toBe('Access denied');
  });

  it('falls back to "Authentication Error" for non-AxiosError', () => {
    const result = getErrorFromResponse(new Error('boom'), 0);
    expect(result.message).toBe('Authentication Error');
  });

  it('falls back to default for unknown status', () => {
    const result = getErrorFromResponse(makeAxiosErr(418, { message: 'teapot' }), 0);
    expect(result.message).toBe('teapot');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend && npx vitest run src/features/auth/utils/__tests__/loginErrorMapping.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// apps/frontend/src/features/auth/utils/loginErrorMapping.ts
import axios from 'axios';

export interface LoginError {
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  errorCode?: string;
}

const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export const getErrorFromResponse = (err: unknown, currentAttempts: number): LoginError => {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    const message = data?.message;
    const errorCode = data?.errorCode;

    if (!err.response) {
      return { type: 'error', message: 'Unable to connect to server', details: 'Please check your internet connection and try again.' };
    }

    if (errorCode) {
      switch (errorCode) {
        case 'USER_NOT_FOUND':
          return { type: 'error', message: 'Account not found', details: 'No account exists with this email address.', errorCode };
        case 'WRONG_PASSWORD': {
          const remainingAttempts = MAX_LOGIN_ATTEMPTS - currentAttempts - 1;
          return {
            type: 'error',
            message: 'Incorrect password',
            details: remainingAttempts > 0
              ? `${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
              : 'This is your last attempt!',
            errorCode,
          };
        }
        case 'ACCOUNT_DISABLED':
          return { type: 'error', message: 'Account suspended', details: 'Please contact the system administrator.', errorCode };
      }
    }

    switch (status) {
      case 400:
        return { type: 'error', message: 'Invalid request', details: Array.isArray(message) ? message.join(', ') : message };
      case 401:
        return { type: 'error', message: message || 'Authentication failed', details: 'Check your credentials.' };
      case 403:
        return { type: 'error', message: 'Access denied', details: 'Clearance required.' };
      case 423:
        return { type: 'warning', message: 'Security lock active', details: 'Too many attempts. Wait 15 minutes.' };
      case 429:
        return { type: 'warning', message: 'Rate limit exceeded', details: `Wait ${RATE_LIMIT_WINDOW_SECONDS} seconds.` };
      case 500: case 502: case 503:
        return { type: 'error', message: 'Server unavailable', details: 'System offline. Try again later.' };
      default:
        return { type: 'error', message: message || 'Login failed', details: 'An unexpected error occurred.' };
    }
  }
  return { type: 'error', message: 'Authentication Error', details: 'System malfunction. Please retry.' };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/frontend && npx vitest run src/features/auth/utils/__tests__/loginErrorMapping.test.ts`
Expected: PASS — 15 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/auth/utils/
git commit -m "refactor(auth): extract getErrorFromResponse to pure module"
```

- [ ] **Step 6: Update BentoLoginPage to import the extracted function**

In `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx`:
- Add at top: `import { getErrorFromResponse, type LoginError } from '../utils/loginErrorMapping';`
- Remove the local `getErrorFromResponse` function
- Remove the local `LoginError` interface
- Keep `MAX_LOGIN_ATTEMPTS` and `RATE_LIMIT_WINDOW_SECONDS` constants inline (used by UI for rate-limit warning)

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd apps/frontend && npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/features/auth/pages/BentoLoginPage.tsx
git commit -m "refactor(auth): use extracted getErrorFromResponse in BentoLoginPage"
```

---

### Task 2: Add new design tokens (grid, glows, vignette)

**Files:**
- Modify: `apps/frontend/src/styles/tokens.css`

- [ ] **Step 1: Read existing tokens.css structure**

```bash
cat apps/frontend/src/styles/tokens.css
```

Expected: see how variables are organized. Likely `:root { ... }` for shared, and `[data-theme="dark"]` / `[data-theme="light"]` for theme-specific.

- [ ] **Step 2: Add new variables to dark theme block**

Inside the `[data-theme="dark"]` block, add at the end:

```css
/* Background composition (login page) */
--grid-line: rgba(255, 255, 255, 0.025);
--grid-size: 40px;
--glow-1: hsla(220, 90%, 60%, 0.10);
--glow-2: hsla(280, 80%, 60%, 0.05);
--vignette: rgba(0, 0, 0, 0.35);
```

- [ ] **Step 3: Add new variables to light theme block**

Inside the `[data-theme="light"]` block, add:

```css
--grid-line: rgba(0, 0, 0, 0.045);
--grid-size: 40px;
--glow-1: hsla(220, 90%, 50%, 0.08);
--glow-2: hsla(280, 80%, 50%, 0.04);
--vignette: rgba(0, 0, 0, 0.04);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/frontend && npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/styles/tokens.css
git commit -m "feat(design-tokens): add background composition variables (grid, glows, vignette)"
```

---

### Task 3: Apply 5-layer background to body

**Files:**
- Modify: `apps/frontend/src/index.css`

- [ ] **Step 1: Find current body styles**

```bash
grep -rn "body {" apps/frontend/src/ --include="*.css" 2>/dev/null | head -5
```

- [ ] **Step 2: Add easing curves to :root if not present**

If `:root` doesn't have `--ease-out` and `--ease-spring`, add:

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-spring: cubic-bezier(0.22, 1.2, 0.36, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
}
```

- [ ] **Step 3: Replace body background with 5-layer composite**

Find the existing `body` block and replace its `background` / `background-color` / `transition` lines with:

```css
body {
  background-color: var(--bg);
  background-image:
    radial-gradient(ellipse 80% 70% at 50% 50%, transparent 35%, var(--vignette) 100%),
    radial-gradient(ellipse 70% 55% at 88% -8%, var(--glow-1) 0%, transparent 60%),
    radial-gradient(ellipse 55% 45% at 12% 108%, var(--glow-2) 0%, transparent 60%),
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 100% 100%, 100% 100%, 100% 100%, var(--grid-size) var(--grid-size), var(--grid-size) var(--grid-size);
  background-attachment: fixed;
  transition: background-color 0.4s var(--ease-in-out), color 0.4s var(--ease-in-out);
}
```

(Keep all other body styles — font-family, color, line-height, etc.)

- [ ] **Step 4: Verify in browser**

Run: `cd apps/frontend && npm run dev`
Open `http://localhost:5173/login`
Expected: subtle grid visible on the page background, accent glow top-right, purple glow bottom-left, edges darker. The login card area will be covered by the card's surface bg.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/index.css
git commit -m "feat(design-system): apply 5-layer background composite"
```

---

### Task 4: Write smoke test for BentoLoginPage (TDD)

**Files:**
- Create: `apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.test.tsx`

- [ ] **Step 1: Write the smoke test**

```typescript
// apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BentoLoginPage } from '../BentoLoginPage';

describe('BentoLoginPage smoke', () => {
  it('renders the sign-in form fields and submit button', () => {
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue|sign in|authenticate/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (likely passes against current code)**

Run: `cd apps/frontend && npx vitest run src/features/auth/pages/__tests__/BentoLoginPage.test.tsx`
Expected: PASS (against current code) — that's fine; test continues to pass after rewrite.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.test.tsx
git commit -m "test(auth): add BentoLoginPage smoke test"
```

---

### Task 5: Rewrite BentoLoginPage with 3-row layout structure

**Files:**
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx` (full rewrite)

- [ ] **Step 1: Create useTheme hook if it doesn't exist**

```bash
test -f apps/frontend/src/hooks/useTheme.ts || cat > apps/frontend/src/hooks/useTheme.ts << 'EOF'
import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'idesk-theme';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored ?? 'dark';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
};
EOF
```

- [ ] **Step 2: Write the new BentoLoginPage**

Replace the entire `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx` with:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../stores/useAuth';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertTriangle, WifiOff, Lock, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getErrorFromResponse, type LoginError } from '../utils/loginErrorMapping';
import { useTheme } from '@/hooks/useTheme';
import api from '../../../lib/api';

const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export const BentoLoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState<LoginError | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [rememberMe, setRememberMe] = useState(false);
    const { theme, toggle: toggleTheme } = useTheme();
    const login = useAuth((state) => state.login);
    const navigate = useNavigate();

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const update = () => {
            const el = document.getElementById('utc-clock');
            if (!el) return;
            const d = new Date();
            const hh = String(d.getUTCHours()).padStart(2, '0');
            const mm = String(d.getUTCMinutes()).padStart(2, '0');
            const ss = String(d.getUTCSeconds()).padStart(2, '0');
            el.textContent = `${hh}:${mm}:${ss} UTC`;
        };
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        setCapsLockOn(e.getModifierState('CapsLock'));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim() || !password) {
            setLoginError({
                type: 'warning',
                message: !email.trim() ? 'Email is required.' : 'Password is required.',
                details: 'Both email and password are required.',
            });
            return;
        }

        if (!isOnline) {
            setLoginError({
                type: 'error',
                message: 'Network disconnected',
                details: 'Offline mode active. Connection required for authentication.',
            });
            return;
        }

        setLoginError(null);
        setIsLoading(true);

        try {
            const res = await api.post('/auth/login', { email, password });
            const { user } = res.data;
            setFailedAttempts(0);
            login(user);

            if (user.role === 'ADMIN' || user.role === 'AGENT') {
                navigate('/dashboard');
            } else if (user.role === 'MANAGER') {
                navigate('/manager/dashboard');
            } else {
                navigate('/client/my-tickets');
            }
        } catch (err: unknown) {
            const newAttemptCount = failedAttempts + 1;
            const error = getErrorFromResponse(err, failedAttempts);
            setLoginError(error);
            if (error.type === 'error' && error.errorCode !== 'USER_NOT_FOUND') {
                setFailedAttempts(newAttemptCount);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col">
            <header className="flex items-center justify-between px-9 py-5 animate-fade-down">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-purple-500 shadow-sm" />
                    <span className="font-semibold tracking-tight text-foreground">iDesk</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                    <span className="tabular-nums" id="utc-clock">--:--:-- UTC</span>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                        className="w-8 h-8 grid place-items-center border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                </div>
            </header>

            <main className="flex-1 grid place-items-center px-4 py-6">
                <div className="w-full max-w-[440px] bg-card border border-border rounded-2xl shadow-2xl p-8 relative animate-rise">
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-2">Sign in</h1>
                    <p className="text-sm text-muted-foreground mb-6">Enter your credentials to continue.</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <button
                            type="submit"
                            disabled={isLoading || !isOnline}
                            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Continue
                        </button>
                    </form>
                </div>
            </main>

            <footer className="px-9 pb-6 animate-fade-up" style={{ animationDelay: '0.7s' }}>
                <hr className="border-border mb-4 animate-hairline" style={{ animationDelay: '0.85s' }} />
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span>v3.18.2</span>
                    <span className="text-border-strong">·</span>
                    <span>All systems normal</span>
                    <span className="text-border-strong">·</span>
                    <span>© 2026 iDesk</span>
                </div>
            </footer>
        </div>
    );
};
```

- [ ] **Step 3: Verify smoke test passes**

Run: `cd apps/frontend && npx vitest run src/features/auth/pages/__tests__/BentoLoginPage.test.tsx`
Expected: PASS

- [ ] **Step 4: Verify in browser**

Run: `cd apps/frontend && npm run dev`
Open `http://localhost:5173/login`
Expected: topbar with iDesk + clock + theme toggle, centered card with "Sign in" + submit, status footer at bottom. Background shows grid + glows.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/auth/pages/BentoLoginPage.tsx apps/frontend/src/hooks/useTheme.ts
git commit -m "feat(auth): rewrite BentoLoginPage with 3-row layout structure"
```

---

### Task 6: Add card chrome (corner ticks, header, divider, footer)

**Files:**
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx`

- [ ] **Step 1: Add corner ticks + card header**

Replace the card div with:

```tsx
<div className="w-full max-w-[440px] bg-card border border-border rounded-2xl shadow-2xl p-8 relative animate-rise">
  {/* Corner ticks */}
  <span className="absolute top-0 left-0 w-3 h-3 border-t-[1.5px] border-l-[1.5px] border-primary animate-scale-in" style={{ animationDelay: '0.1s' }} />
  <span className="absolute top-0 right-0 w-3 h-3 border-t-[1.5px] border-r-[1.5px] border-primary animate-scale-in" style={{ animationDelay: '0.16s' }} />
  <span className="absolute bottom-0 left-0 w-3 h-3 border-b-[1.5px] border-l-[1.5px] border-primary animate-scale-in" style={{ animationDelay: '0.22s' }} />
  <span className="absolute bottom-0 right-0 w-3 h-3 border-b-[1.5px] border-r-[1.5px] border-primary animate-scale-in" style={{ animationDelay: '0.28s' }} />

  {/* Card header */}
  <div className="flex items-center gap-2 mb-6 text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-widest animate-rise" style={{ animationDelay: '0.08s' }}>
    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
    <span>iDesk · Operations</span>
  </div>

  <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-2 animate-rise" style={{ animationDelay: '0.16s' }}>Sign in</h1>
  <p className="text-sm text-muted-foreground mb-6 animate-rise" style={{ animationDelay: '0.22s' }}>Enter your credentials to continue.</p>
  <hr className="border-border mb-6 animate-hairline" style={{ animationDelay: '0.28s' }} />

  <form onSubmit={handleSubmit} className="space-y-4">
    <button
      type="submit"
      disabled={isLoading || !isOnline}
      className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors animate-rise"
      style={{ animationDelay: '0.52s' }}
    >
      Continue
    </button>
  </form>

  {/* Card footer */}
  <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-3 text-xs font-mono text-muted-foreground animate-rise" style={{ animationDelay: '0.66s' }}>
    <span><kbd className="px-1.5 py-0.5 rounded border border-border bg-foreground/5">↵</kbd> Enter to continue</span>
    <span className="text-border-strong">·</span>
    <span><kbd className="px-1.5 py-0.5 rounded border border-border bg-foreground/5">Esc</kbd> Clear</span>
  </div>
</div>
```

- [ ] **Step 2: Add keyframes + utility classes to index.css**

In `apps/frontend/src/index.css`, add:

```css
@keyframes rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fade-down {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes scale-in {
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes hairline {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 currentColor; }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

.animate-rise { animation: rise 0.55s var(--ease-out) both; }
.animate-fade-down { animation: fade-down 0.5s var(--ease-out) both; }
.animate-fade-up { animation: fade-up 0.5s var(--ease-out) both; }
.animate-scale-in { animation: scale-in 0.5s var(--ease-spring) both; }
.animate-hairline { animation: hairline 0.7s var(--ease-out) both; transform-origin: left; }
.animate-pulse { animation: pulse 2.4s ease-out infinite; }
```

- [ ] **Step 3: Verify in browser**

Reload `/login`
Expected: card has 4 accent corner ticks that scale in, card header with green pulse dot, divider draws, kbd hints in footer.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/auth/pages/BentoLoginPage.tsx apps/frontend/src/index.css
git commit -m "feat(auth): add card chrome (corners, header, divider, footer) + animation keyframes"
```

---

### Task 7: Add form fields (email, password, keep-forgot, SSO)

**Files:**
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx`

- [ ] **Step 1: Replace the placeholder submit with full form**

Replace the form contents (just the submit button from T6) with:

```tsx
<form onSubmit={handleSubmit} className="space-y-4">
  {/* Email field */}
  <div className="animate-rise" style={{ animationDelay: '0.34s' }}>
    <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Email</label>
    <input
      id="email"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="you@company.com"
      autoComplete="email"
      required
      disabled={isLoading}
      className="w-full h-11 px-3.5 rounded-lg bg-background/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
    />
  </div>

  {/* Password field */}
  <div className="animate-rise" style={{ animationDelay: '0.40s' }}>
    <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Password</label>
    <div className="relative">
      <input
        id="password"
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="••••••••"
        autoComplete="current-password"
        required
        disabled={isLoading}
        className="w-full h-11 px-3.5 pr-11 rounded-lg bg-background/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        tabIndex={-1}
        aria-label="Toggle password visibility"
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center text-muted-foreground hover:text-foreground rounded transition-colors"
      >
        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
    {capsLockOn && (
      <p className="mt-2 text-xs text-amber-500 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" /> Caps Lock is on
      </p>
    )}
  </div>

  {/* Keep me signed in + Forgot password */}
  <div className="flex items-center justify-between animate-rise" style={{ animationDelay: '0.46s' }}>
    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
      <input
        type="checkbox"
        checked={rememberMe}
        onChange={(e) => setRememberMe(e.target.checked)}
        disabled={isLoading}
        className="w-4 h-4 rounded border-border accent-primary"
      />
      <span>Keep me signed in</span>
    </label>
    <a href="#" className="text-sm text-primary hover:text-primary/80">Forgot password?</a>
  </div>

  {/* Submit button */}
  <button
    type="submit"
    disabled={isLoading || !isOnline}
    className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/95 hover:shadow-lg hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-[transform,box-shadow,background] duration-200 animate-rise"
    style={{ animationDelay: '0.52s' }}
  >
    Continue
  </button>
</form>

{/* SSO link */}
<div className="mt-6 text-center text-sm text-muted-foreground animate-rise" style={{ animationDelay: '0.58s' }}>
  <a href="#" className="border-b border-dashed border-border hover:text-foreground hover:border-foreground pb-0.5">Use single sign-on (SSO)</a>
</div>
```

- [ ] **Step 2: Verify in browser**

Reload `/login`
Expected: email field, password field with eye toggle, keep-forgot row, submit, SSO link below.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/auth/pages/BentoLoginPage.tsx
git commit -m "feat(auth): add email, password, keep-forgot, SSO form fields"
```

---

### Task 8: Add error pill, shake animation, offline banner, attempts warning

**Files:**
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx`
- Modify: `apps/frontend/src/index.css`

- [ ] **Step 1: Add shake keyframe to index.css**

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-5px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}
.animate-shake { animation: shake 0.42s var(--ease-spring); }
```

- [ ] **Step 2: Add error pill, offline banner, attempts warning inside the card (above the form)**

Insert before the `<form>`:

```tsx
{/* Offline banner */}
{!isOnline && (
  <div className="mb-4 p-3 rounded-lg bg-secondary border border-border text-muted-foreground text-sm flex items-start gap-2">
    <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
    <div>
      <p className="font-semibold text-foreground">System Offline</p>
      <p className="text-xs mt-0.5">Check your network connection to authenticate.</p>
    </div>
  </div>
)}

{/* Error pill */}
{loginError && (
  <div
    className={cn(
      'mb-4 p-3 rounded-lg border text-sm flex items-start gap-2',
      loginError.type === 'warning'
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
        : 'bg-destructive/10 border-destructive/20 text-destructive'
    )}
  >
    {loginError.type === 'warning' ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <Lock className="w-4 h-4 shrink-0 mt-0.5" />}
    <div>
      <p className="font-semibold">{loginError.message}</p>
      {loginError.details && <p className="text-xs opacity-80 mt-0.5">{loginError.details}</p>}
    </div>
  </div>
)}

{/* Attempts remaining warning */}
{failedAttempts >= 3 && !loginError && (
  <div className="mb-4 text-xs font-mono text-amber-500 flex items-center gap-2">
    <AlertTriangle className="w-3 h-3" />
    {5 - failedAttempts > 0
      ? `WARNING: ${5 - failedAttempts} attempt(s) remaining`
      : 'CRITICAL: account lockout imminent'}
  </div>
)}
```

- [ ] **Step 3: Add shake class to form when error present**

Update the form element:

```tsx
<form
  onSubmit={handleSubmit}
  className={cn('space-y-4', loginError && 'animate-shake')}
>
```

- [ ] **Step 4: Test error display**

Submit empty form → expect "Email is required" / "Password is required" error with shake animation.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/auth/pages/BentoLoginPage.tsx apps/frontend/src/index.css
git commit -m "feat(auth): add error pill, shake animation, offline banner, attempts warning"
```

---

### Task 9: Add prefers-reduced-motion support

**Files:**
- Modify: `apps/frontend/src/index.css`

- [ ] **Step 1: Add reduced-motion media query**

In `apps/frontend/src/index.css`, append:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Verify**

DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce" → Reload `/login`
Expected: no stagger, no pulse — everything instant.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/index.css
git commit -m "feat(design-system): honor prefers-reduced-motion"
```

---

### Task 10: Delete orphaned LoginPage.tsx

**Files:**
- Delete: `apps/frontend/src/features/auth/pages/LoginPage.tsx`

- [ ] **Step 1: Verify no imports**

```bash
grep -rn "LoginPage" apps/frontend/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "BentoLoginPage\|__tests__\|.bak"
```

Expected: empty (no matches outside the file itself or its tests).

- [ ] **Step 2: Delete the file**

```bash
rm apps/frontend/src/features/auth/pages/LoginPage.tsx
```

- [ ] **Step 3: Verify build still works**

Run: `cd apps/frontend && npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add -u apps/frontend/src/features/auth/pages/
git commit -m "chore(auth): remove orphaned LoginPage.tsx"
```

---

### Task 11: Add integration test for BentoLoginPage state machine

**Files:**
- Create: `apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../lib/api', () => ({
  default: { post: vi.fn() },
}));
vi.mock('../../../stores/useAuth', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

import api from '../../../lib/api';
import { BentoLoginPage } from '../BentoLoginPage';

const mockApi = api as unknown as { post: ReturnType<typeof vi.fn> };

describe('BentoLoginPage integration', () => {
  beforeEach(() => {
    mockApi.post.mockReset();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('shows error when email is empty', async () => {
    render(<MemoryRouter><BentoLoginPage /></MemoryRouter>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/password/i), 'something');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it('shows error when password is empty', async () => {
    render(<MemoryRouter><BentoLoginPage /></MemoryRouter>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('calls api.post with email and password on submit', async () => {
    mockApi.post.mockResolvedValue({ data: { user: { role: 'ADMIN' } } });
    render(<MemoryRouter><BentoLoginPage /></MemoryRouter>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'admin@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email: 'admin@example.com', password: 'password123' });
    });
  });

  it('displays error from API on 401 WRONG_PASSWORD', async () => {
    mockApi.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { errorCode: 'WRONG_PASSWORD' } },
    });
    render(<MemoryRouter><BentoLoginPage /></MemoryRouter>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'admin@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument();
  });

  it('displays error from API on 423 lockout', async () => {
    mockApi.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 423, data: { message: 'Locked' } },
    });
    render(<MemoryRouter><BentoLoginPage /></MemoryRouter>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'admin@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/security lock active/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

Run: `cd apps/frontend && npx vitest run src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx`
Expected: PASS — 5 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx
git commit -m "test(auth): add BentoLoginPage integration test for state machine"
```

---

### Task 12: Final visual verification

**Files:** (no code changes; verification only)

- [ ] **Step 1: Build for production**

Run: `cd apps/frontend && npm run build`
Expected: build succeeds, no TypeScript errors

- [ ] **Step 2: Visual check — dark theme**

Run: `cd apps/frontend && npm run dev`
Open `http://localhost:5173/login`
Verify against the spec section 4:
- Background: subtle grid + accent glow top-right + purple glow bottom-left + vignette
- Card: 440px wide, surface bg, 1px border, corner ticks (accent), top inner highlight
- Card header: green pulse dot + "iDesk · Operations" eyebrow
- Headline: "Sign in" (Plus Jakarta Sans, 30px, semibold)
- Sub: muted, "Enter your credentials to continue."
- Divider: hairline below sub
- Form fields: email, password (with eye toggle)
- Keep me signed in + Forgot password row
- Submit button: accent blue, "Continue" label
- SSO link below
- Card footer: `↵ Enter to continue · Esc Clear`
- Topbar: brand + UTC clock + theme toggle
- Bottombar: status dot, version, "All systems normal", copyright
- All elements fade/rise in sequence on load

- [ ] **Step 3: Visual check — light theme**

Click theme toggle (top-right)
Verify:
- Background: same pattern but lower contrast
- Card: white surface, dark text
- All text readable, sufficient contrast
- Grid pattern still visible but more subtle
- Theme persists across reload (localStorage)

- [ ] **Step 4: State machine check**

- Submit empty form → "Email is required" error pill, form shakes
- Submit with email but no password → "Password is required"
- Submit with both → loading state (button shows spinner or disabled)
- Toggle Caps Lock (key press with CapsLock on) → "Caps Lock is on" warning under password field
- Disconnect network (DevTools) → "System Offline" banner appears, submit button disabled

- [ ] **Step 5: Reduced motion check**

DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce" → Reload `/login`
Verify: no stagger animation, no pulse, all transitions instant

- [ ] **Step 6: Keyboard / a11y check**

- Tab order: email → password → eye toggle → keep me signed in → forgot password → submit → SSO
- Focus ring visible on each (accent border + 3px ring)
- Submit form by pressing Enter
- All `aria-label`s present (theme toggle, password reveal)

- [ ] **Step 7: Final commit (if any tweaks)**

```bash
git status
# If any uncommitted tweaks:
git add -A
git commit -m "fix(auth): post-implementation tweaks from visual verification"
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task |
|---|---|
| §4.1 Layout (topbar/stage/bottombar) | T5 |
| §4.2 Card properties | T5, T6 |
| §4.3 Background 5-layer composite | T2, T3 |
| §4.4 Typography (Plus Jakarta Sans / JetBrains Mono) | Already loaded in `index.html` (no new work) |
| §4.5 Form fields | T7 |
| §4.6 Card structure (corners, header, divider, footer) | T6 |
| §5.1 Easing curves | T3 (root tokens) |
| §5.2 Page reveal stagger | T6, T7, T8 (animationDelay inline) |
| §5.3 Interaction animations (focus, hover) | T7 (Tailwind transitions on inputs/buttons) |
| §5.4 State transitions (loading, error, success) | T8 (loading), T11 (integration tests) |
| §5.5 Reduced motion | T9 |
| §6 State machine + trigger conditions | T1 (extracted), T11 (tests) |
| §7 Preserved logic (caps lock, offline, rate limit, role redirect) | T5 (preserved handlers) |
| §8 Components (inline) | T5-T8 |
| §9 File scope (modify Bento, delete Login) | T5, T10 |
| §10 Test plan | T1, T4, T11 |

**2. Placeholder scan:** No TBD / TODO / "implement later" / "similar to Task N" placeholders. All code blocks are complete and runnable. All file paths are exact.

**3. Type consistency:**
- `LoginError` interface defined in T1, used throughout via import.
- `getErrorFromResponse(err, currentAttempts)` signature consistent across T1, T8 (used in catch).
- Submit button `isLoading` state used in T7 (disabled prop) and would be extended in T8 if more states added.
- `api.post` mock signature consistent in T11.
- `useTheme` returns `{ theme, toggle }` consistently in T5 and T11.

All consistent.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-15-login-page-redesign.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
