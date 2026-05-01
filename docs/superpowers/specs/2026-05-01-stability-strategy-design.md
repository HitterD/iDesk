# Stability Strategy — Structural Contract Design

**Date:** 2026-05-01
**Status:** Approved
**Scope:** Frontend error handling architecture, ErrorBoundary topology, AI code generation rules

---

## Context

Two bugs were fixed that shared the same root cause: AI-generated code made locally correct decisions without considering system-wide invariants.

- **Bug 1 (Logout):** `ErrorBoundary` wrapped `<Router>` in App.tsx. `navigate()` only changes URL within React tree — it does not unmount the ErrorBoundary, so `hasError` never resets. Fix required `window.location.href` (hard reload = new React tree).
- **Bug 2 (Error page light mode):** Hardcoded `bg-navy-main text-white text-slate-400` used in ErrorBoundary fallback — dark-mode-specific classes in a theme-agnostic component. Fix: replace with semantic tokens `bg-background text-foreground text-muted-foreground`.

**Structural root cause:** The codebase has no explicit error propagation blueprint. Each AI-generated feature makes local error handling decisions independently, producing inconsistent patterns. Since there are no tests or monitoring, violations accumulate silently.

**Primary risk:** Silent bugs — incorrect state or data corruption with no visible error signal.

---

## Section 1 — ErrorBoundary Topology

### Target Structure

```
App.tsx
└── <Router>
    ├── RootErrorBoundary              ← Level 1: catastrophic errors
    │   └── <Routes>
    │       ├── /admin/* layout
    │       │   └── LayoutErrorBoundary    ← Level 2: per-layout
    │       │       └── FeatureErrorBoundary   ← Level 3: per-feature (optional)
    │       ├── /client/* layout
    │       │   └── LayoutErrorBoundary
    │       └── /login                 ← no boundary needed
```

### Reset Mechanism

Use `key={location.pathname}` on layout-level ErrorBoundary. When route changes, React unmounts and remounts the boundary, resetting `hasError` automatically. No custom callbacks or libraries required.

```tsx
const location = useLocation();
return (
  <ErrorBoundary key={location.pathname}>
    <Outlet />
  </ErrorBoundary>
);
```

### Fallback Behavior Per Level

| Level | Fallback | Reset Action |
|-------|----------|--------------|
| RootErrorBoundary | Full-page error + "Refresh" button | `window.location.href` only — never `navigate()` |
| LayoutErrorBoundary | Inline error panel + "Try again" | Reset boundary state only (not full reload) |
| FeatureErrorBoundary | Minimal inline message: "Gagal memuat bagian ini." | Reset boundary state |

### Hard Rules

- `ErrorBoundary` must always be **inside** `<Router>`, never wrapping it
- `navigate()` must never appear inside any ErrorBoundary fallback
- Hardcoded color classes (`bg-navy-main`, `text-white`) are forbidden in error UI — use `bg-background text-foreground text-muted-foreground`

---

## Section 2 — Error Handling Contract (3 Tiers)

### Tier 1 — Expected API Errors → Toast

**Conditions:** 4xx responses, validation failures, resource not found.

**Implementation:** Single configuration point in `QueryClient`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { onError: (err) => toast.error(extractMessage(err)) },
    queries: {
      retry: 1,
      throwOnError: (error) => error.status >= 500,  // 5xx → Tier 2
    },
  },
});
```

**Violations to avoid:**
- Per-component try-catch for API calls
- `console.error` without any UI feedback
- Silent catch blocks: `catch(() => {})`

### Tier 2 — Unexpected Throws → ErrorBoundary

**Conditions:** Render errors, null dereference, unexpected data shape, 5xx responses.

**Implementation:** Do not catch — let errors bubble up to the nearest ErrorBoundary. The boundary logs to `console.error` (minimum) or Sentry (when added).

**Key rule:** `try-catch` inside render/JSX is a red flag — it hides errors from the ErrorBoundary.

### Tier 3 — Auth Failures → Redirect

**Conditions:** 401 responses, expired tokens, invalid sessions.

**Implementation:** Single Axios interceptor — not per-endpoint:

```ts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      performLogout().then(() => {
        window.location.href = '/login';  // hard redirect, not navigate()
      });
    }
    return Promise.reject(error);
  }
);
```

**Violations to avoid:**
- Per-endpoint 401 handling
- Using `navigate()` for auth redirects
- Handling auth state cleanup outside `performLogout()`

### Decision Tree

```
Error terjadi di mana?
├── API call gagal (4xx) → Tier 1: toast
├── API call (5xx) → Tier 2: bubble ke ErrorBoundary (throwOnError)
├── API call (401) → Tier 3: logout + window.location.href = '/login'
├── Unexpected throw / null / shape salah → Tier 2: biarkan bubble
└── try-catch yang "mengamankan" render → ❌ hapus, biarkan crash ke ErrorBoundary
```

---

## Section 3 — AI Enforcement (CLAUDE.md Rules)

The following rules must be added to `CLAUDE.md` to ensure all AI-generated code follows this contract.

### Error Handling Rules

```
## §ERROR HANDLING CONTRACT

Setiap kode yang menyentuh error WAJIB ikuti 3-tier:

TIER 1 — API error (4xx): gunakan TanStack Query onError global
  → JANGAN tambah try-catch per-komponen untuk API calls
  → JANGAN console.error tanpa UI feedback

TIER 2 — Unexpected throw: biarkan bubble ke ErrorBoundary
  → JANGAN wrap render logic dalam try-catch
  → JANGAN swallow error dengan catch(() => {})

TIER 3 — Auth error (401): tangani di axios interceptor saja
  → JANGAN tambah 401 handling per-endpoint
  → JANGAN navigate() untuk logout redirect — gunakan window.location.href
```

### ErrorBoundary Rules

```
## §ERROR BOUNDARY RULES

WAJIB: ErrorBoundary selalu di dalam <Router>, tidak pernah wrapping-nya
WAJIB: Layout ErrorBoundary pakai key={location.pathname}
DILARANG: navigate() di dalam ErrorBoundary fallback
DILARANG: hardcoded color classes (bg-navy-main, text-white) di error UI
  → Gunakan: bg-background text-foreground text-muted-foreground
```

---

## Audit Checklist (One-Time)

Run these grep searches to find existing violations:

```bash
# Tier 2 violations — swallowed errors
grep -r "catch.*{}" apps/frontend/src --include="*.tsx" --include="*.ts"

# Tier 1 violations — console.error without UI feedback
grep -r "console\.error" apps/frontend/src --include="*.tsx" --include="*.ts"

# Tier 3 violations — per-component 401 handling
grep -r "401" apps/frontend/src --include="*.tsx" --include="*.ts"

# Color system violations in error components
grep -r "bg-navy-main\|text-white" apps/frontend/src/components/ui --include="*.tsx"

# ErrorBoundary topology violation
grep -r "ErrorBoundary" apps/frontend/src/App.tsx
```

---

## Implementation Phases

**Phase 1 — Audit & Fix Topology** (1 session)
- Run audit checklist above
- Move ErrorBoundary inside Router in App.tsx
- Add `key={location.pathname}` to layout-level boundaries

**Phase 2 — Implement Contract** (1 session)
- Configure `QueryClient` with global `onError` + `throwOnError`
- Add Axios 401 interceptor in `api` lib
- Remove per-component error handling that violates tiers

**Phase 3 — CLAUDE.md Update** (30 minutes)
- Add §ERROR HANDLING CONTRACT and §ERROR BOUNDARY RULES to project CLAUDE.md
- These rules gate all future AI-generated code

---

## Out of Scope

- Test suite (no tests planned in this phase)
- Sentry integration (deferred — add after launch)
- Topik 2: UI Consistency Audit (separate brainstorm)
