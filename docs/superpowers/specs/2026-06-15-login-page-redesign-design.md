# Login Page Redesign — Design Spec

**Date:** 2026-06-15
**Status:** Draft — awaiting user review
**Author:** Claude (brainstorming session)
**Visual companion:** `mockups/login-mockup.html` (load at `http://127.0.0.1:5500/login-mockup.html`)

---

## 1. Context

The iDesk app has two login-page files:

- `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx` — routed at `/login` (the active page; see `AppRoutes.tsx:159`).
- `apps/frontend/src/features/auth/pages/LoginPage.tsx` — **orphaned, not routed anywhere**.

`BentoLoginPage` was styled with a "Bento Grid" glassmorphism treatment that has drifted into AI-generated defaults: faux telemetry (fake `LTC-ZONE-4 12ms` latency, fake "99.99% uptime" badge), a generic "TLS 1.3 SECURE" callout, a decorative "EXT. 1604" hotline number, four panels of ornamentation competing for attention with the actual form, oversized hero typography, and hand-rolled primitives that bypass the existing design system.

The page reads as: decorative bloat > structural polish > actual job (authenticate).

## 2. Goals

1. Make the form the unmistakable focus. Authenticate → land on the dashboard. That is the only job.
2. Replace decorative bloat with structural polish: card frame, corner ticks, status surface, footer chrome, layered background.
3. Treat animation as a functional system (focus, loading, success, error, presence) — never decoration.
4. Match typography to the rest of the app (Plus Jakarta Sans / JetBrains Mono) so the login page does not feel like a separate product.
5. Preserve every existing behavior: error mapping, caps lock detection, online/offline handling, rate limiting, role-based redirects.

## 3. Design Direction

**Editorial Restraint (Vercel/Resend-style), dark primary, theme-aware.**

Rationale:
- **Anti-AI-slop** — removes fake data, generic tropes, decorative bloat.
- **Anti-monotonous** — card structure, corner ticks, hairline divider, status footer, layered background give the page depth without noise.
- **Enterprise fit** — dark theme reads as "ops room / control surface"; grid pattern + monospace details signal precision.
- **Cohesion** — same fonts, color tokens, easing curves as the rest of iDesk.

Alternatives considered:
- **Mission Console (Linear/Plane-style)** — denser telemetry, real-time sidebar. Rejected: too dense for a single-purpose form page.
- **Banking-Grade (Stripe/Mercury-style)** — marketing-led left rail. Rejected: introduces a marketing voice to a utility page.

## 4. Visual Specification

### 4.1 Layout

Three-row grid: `topbar` (auto) / `stage` (1fr) / `bottombar` (auto).

- **Topbar** — brand mark + "iDesk" wordmark (left), live UTC clock + theme toggle (right). Subtle fade-down reveal.
- **Stage** — vertically and horizontally centered card. Max-width 440px.
- **Bottombar** — hairline divider, monospace status row (status dot, build version, system status, copyright, help link).

### 4.2 Card

| Property | Value |
|---|---|
| Width | 100%, max-width 440px |
| Padding | 32px 30px 22px |
| Border | 1px solid `var(--border)` |
| Background | `var(--surface)` (one shade lighter than page bg) |
| Border-radius | 14px |
| Outer shadow | `0 24px 60px -24px rgba(0,0,0,0.45)` |
| Inner top highlight | 1px gradient line: transparent → accent → transparent, 20px inset from sides |
| Corner ticks | 1.5px L-shapes in `var(--accent)` at 4 corners, 12×12px, sit on the card edge |

### 4.3 Background — 5-Layer Composite

On `body`, `background-attachment: fixed`:

1. **Vignette** — radial ellipse 80%×70% centered, transparent 0–35%, `var(--vignette)` at 100%.
2. **Top-right radial** — accent blue, ellipse 70%×55% at 88% / −8%.
3. **Bottom-left radial** — secondary purple, ellipse 55%×45% at 12% / 108%.
4. **Vertical grid** — 1px lines, 40px spacing, `var(--grid-line)`.
5. **Horizontal grid** — 1px lines, 40px spacing, `var(--grid-line)`.

All five layers are theme-aware via CSS variables. Light mode uses lower grid opacity, softer vignette, and adjusted glow alphas.

### 4.4 Typography

| Slot | Stack | Weight | Size | Tracking |
|---|---|---|---|---|
| Body | `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif` | inherit | 14px | normal |
| Brand wordmark | sans | 600 | 15px | −0.01em |
| Card-header eyebrow | sans | 600 | 11px | 0.10em, uppercase |
| Headline (h1) | sans | 600 | 30px | −0.025em |
| Sub | sans | 400 | 14px | normal |
| Field label | sans | 600 | 11px | 0.08em, uppercase |
| Input text | sans | 400 | 14px | normal |
| Submit button | sans | 600 | 14px | 0.005em |
| Mono (clock, status, footer hints, kbd) | `'JetBrains Mono', 'Fira Code', monospace` | 400 / 500 | 11–12.5px | 0.02–0.04em |

Fonts loaded via Google Fonts (same URL as `apps/frontend/index.html`, filtered to just Plus Jakarta Sans + JetBrains Mono).

### 4.5 Form Fields

- **Email** — `<input type="email" autocomplete="email" placeholder="you@company.com" />`
- **Password** — `<input type="password" autocomplete="current-password" placeholder="••••••••" />` with eye toggle (right-aligned, hover surface-2 bg, swaps input type)
- **Keep me signed in** — checkbox + label (left), `Forgot password?` link with hover underline reveal (right)
- **Submit** — accent bg, white text, full width, 46px tall, rounded 10px, hover lift + accent glow

### 4.6 Card Structure (top → bottom)

1. 4 corner ticks
2. Card header: pulsing green status dot + label "iDesk · Operations"
3. Headline: "Sign in"
4. Sub: "Enter your credentials to continue."
5. Hairline divider (1px, scaleX 0→1 reveal)
6. Form (email field, password field, keep-forgot row, error pill, submit button, SSO link)
7. Card footer: <kbd>↵</kbd> Enter to continue · <kbd>Esc</kbd> Clear

## 5. Animation System

### 5.1 Easing

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Standard rise/fade (Emil Kowalski) |
| `--ease-spring` | `cubic-bezier(0.22, 1.2, 0.36, 1)` | Corner ticks, shake |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Theme color crossfade |

### 5.2 Page Reveal Stagger

| Element | Delay | Effect |
|---|---|---|
| Card itself | 0s | rise 12px + scale 0.985→1, 0.7s |
| Corner TL / TR / BL / BR | 0.10 / 0.16 / 0.22 / 0.28s | scale 0→1, 0.5s spring |
| Topbar | 0s | fade-down −4px, 0.5s |
| Card header | 0.08s | rise 8px, 0.55s |
| Headline h1 | 0.16s | rise 8px, 0.55s |
| Sub p | 0.22s | rise 8px, 0.55s |
| Divider | 0.28s | scaleX 0→1, 0.7s |
| Field email | 0.34s | rise 8px, 0.55s |
| Field password | 0.40s | rise 8px, 0.55s |
| Row keep-forgot | 0.46s | rise 8px, 0.55s |
| Submit | 0.52s | rise 8px, 0.55s |
| SSO link | 0.58s | rise 8px, 0.55s |
| Card footer | 0.66s | rise 8px, 0.55s |
| Bottombar | 0.70s | fade-up 4px, 0.5s |
| Bottombar hairline | 0.85s | scaleX 0→1, 0.9s |

### 5.3 Interaction Animations

- **Input focus** — border → `var(--accent)`, 200ms; 3px `var(--accent-soft)` ring.
- **Input hover** — border → `var(--border-strong)`, 200ms.
- **Submit hover** — translateY −1px + accent-soft box-shadow expansion.
- **Submit active** — translateY 0 + scale 0.99.
- **Forgot link hover** — underline reveal scaleX 0→1 (250ms).
- **Status dot** — pulse 2.4s ease-out infinite, soft green ring expansion.
- **Live UTC clock** — 1Hz text update (no transition needed).
- **Theme toggle** — rotate 15° on hover; color crossfade 0.4s.

### 5.4 State Transitions

- **Loading** — submit label fades out (0.22s); spinner scales in (0.32s); button disabled + 0.85 opacity.
- **Error** — form `.shake` (5px shake, ease-spring 0.42s); inputs `.has-error` border → `var(--destructive)`; error pill reveals with rise.
- **Success** — submit bg → `var(--success)` (green); label fades; checkmark draws via `stroke-dashoffset` 0.45s ease-out 0.08s.
- **Idle** — reset all state classes.

### 5.5 Reduced Motion

`@media (prefers-reduced-motion: reduce)` → animation-duration 0.01ms, transition-duration 0.15s, iteration-count 1. Live clock + status dot pulse stop (set to minimal opacity changes only).

## 6. State Machine

States: `idle` | `loading` | `error` | `success`

Transitions:
- `idle` → `loading` (on submit)
- `loading` → `error` (on API error)
- `loading` → `success` (on API 200)
- `error` → `idle` (on any field edit — clears error)
- `*` → `idle` (on theme toggle — no state change needed)

Trigger conditions (preserved from current implementation):

| Condition | UI message |
|---|---|
| Empty email | "Email is required." |
| Empty password | "Password is required." |
| `!navigator.onLine` | "Network disconnected. Offline mode active." |
| HTTP 401 + `errorCode === 'USER_NOT_FOUND'` | "Account not found" |
| HTTP 401 + `errorCode === 'WRONG_PASSWORD'` | "Incorrect password" + attempts remaining |
| HTTP 401 + `errorCode === 'ACCOUNT_DISABLED'` | "Account suspended" |
| HTTP 423 | "Security lock active — wait 15 minutes" |
| HTTP 429 | "Rate limit exceeded — wait 60 seconds" |
| HTTP 5xx | "Server unavailable" |
| No response | "Unable to connect to server" |
| Default | "Authentication failed" |

## 7. Preserved Logic (do not change)

All existing behavior in `BentoLoginPage` must be preserved:

- Error mapping table (`getErrorFromResponse` function) — exact branches above.
- Caps Lock detection via `e.getModifierState('CapsLock')` → inline warning under password label.
- Online/offline detection via `online` / `offline` events → offline banner above form.
- Failed attempt counter (5 max, 60s window) → banner when ≥3 failed attempts.
- Role-based navigation post-login:
  - `ADMIN` or `AGENT` → `/dashboard`
  - `MANAGER` → `/manager/dashboard`
  - `CLIENT` (default) → `/client/my-tickets`
- `useAuth.login(user)` zustand action.
- `api.post('/auth/login', { email, password })` — backend route unchanged.
- `disabled={isLoading || !isOnline}` on submit.
- `required` and `autoComplete` attributes on inputs.

## 8. New / Extracted Components

Inside the new `BentoLoginPage.tsx`, no new shared components are needed (single use). All primitives remain inline.

Candidates for future extraction (YAGNI for v1 — only extract on second use):
- `<AuthCard>` — 440px card with corners, header, divider, footer slot.
- `<AuthField>` — label + input + optional reveal toggle.
- `<AuthButton>` — accent button with state layers (label, spinner, check).
- `<StatusPill>` — header dot + label.

## 9. File Scope

| Action | File | Reason |
|---|---|---|
| Modify | `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx` | Full rewrite of JSX; preserve all handlers, error mapping, state |
| Delete | `apps/frontend/src/features/auth/pages/LoginPage.tsx` | Orphaned — not routed anywhere (`AppRoutes.tsx:159` confirms only `BentoLoginPage` is wired) |
| No change | `apps/frontend/src/stores/useAuth.ts` | Unchanged |
| No change | `apps/frontend/src/lib/api.ts` | Unchanged |
| No change | `apps/frontend/src/routes/AppRoutes.tsx` | Unchanged |
| No change | `apps/frontend/src/components/auth/ProtectedRoute.tsx` | Unchanged |

## 10. Test Plan

### 10.1 Unit (Vitest)

- `getErrorFromResponse` covers all `errorCode` branches + status code branches + non-AxiosError fallback.
- `handleSubmit` validation: empty email → error, empty password → error, `!isOnline` → error.
- Role redirect logic: ADMIN/AGENT/MANAGER/CLIENT each → correct path.
- Caps Lock state toggles via `e.getModifierState`.
- Failed attempt counter increments only on real errors (not USER_NOT_FOUND).

### 10.2 Integration

- Render `<BentoLoginPage />` with `MemoryRouter` and mocked `useAuth`.
- Fill valid credentials → loading state visible → success morph → `login()` called → `navigate()` called with correct path.
- Fill invalid credentials → error state → shake animation → error message visible.

### 10.3 E2E (Playwright)

- Sign-in journey for each role (ADMIN, AGENT, MANAGER, CLIENT).
- Theme toggle persists across reload (localStorage).
- Form blocks submission when offline (mock offline event).
- Caps Lock warning appears on keydown with CapsLock on.
- Forgot password / SSO links navigate to placeholder or `#`.
- Reduced-motion: animations don't break layout (regression check).

### 10.4 Visual / Manual

- Verify in dark + light theme.
- Verify in Chrome, Edge, Firefox.
- Verify focus order is logical: email → password → remember → submit.
- Verify screen reader announces form fields, error messages, and state changes (aria-live for error pill).
- Verify background pattern doesn't bleed through card.
- Verify corner ticks don't shift during theme transition.

## 11. Out of Scope

- 2FA challenge flow (separate spec if needed).
- Password reset flow (separate spec).
- Account recovery / registration (separate spec).
- SSO backend integration (UI link is a stub).
- Backend changes — `/auth/login` contract unchanged.
- Marketing pages, public landing, sign-up.

## 12. Resolved Decisions

| Question | Resolution |
|---|---|
| Which file gets the new design? | `BentoLoginPage.tsx` (active); `LoginPage.tsx` deleted (orphaned) |
| Dark or light primary? | Dark primary, light mode available via theme toggle |
| Background treatment? | 5-layer composite: vignette + 2 corner radials + grid pattern |
| Font stack? | Plus Jakarta Sans (sans) + JetBrains Mono (mono), matching existing app |
| Animation philosophy? | Functional only — focus, load, error, success, presence. No decorative motion. |
| Corner ticks? | Yes — accent L-marks at 4 corners, scale-in on load |
| Status footer? | Yes — monospace row with version, system status, copyright, help |
| SSO / Forgot password? | Stub links (visual only, no real routes) |
| Remember me? | Visual checkbox; wire to backend if/when `/auth/login` accepts it |
