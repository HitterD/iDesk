# Role-based Session Duration + "Keep Session Active" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make access token expiry role-based (USER=1h, staff roles=8h) and wire up the existing but non-functional "Keep session active" checkbox to extend the refresh token to 90 days.

**Architecture:** Three small, sequential edits to existing files — no new files. Backend: `auth.service.ts` computes expiry by role and accepts a `rememberMe` flag that widens refresh-token life; `auth.controller.ts` passes `rememberMe` from the request body through to the service and uses the resulting expiry to set cookie `maxAge` dynamically instead of a hardcoded value. Frontend: `BentoLoginPage.tsx` sends the existing `rememberMe` state field in the login request body (it already exists in state and JSX; it's just never sent).

**Tech Stack:** NestJS + `@nestjs/jwt`, Passport local strategy, Jest (backend), Vitest + Testing Library (frontend), Axios.

## Global Constraints

- Access token expiry: USER = `1h`. ADMIN, AGENT, AGENT_OPERATIONAL_SUPPORT, AGENT_ORACLE, MANAGER = `8h`.
- Refresh token expiry: `7d` default, `90d` when `rememberMe` is true. Never infinite/no-expiry.
- No new files. No new dependencies.
- Cookie flags (`httpOnly`, `secure`, `sameSite`, `path`) unchanged.
- `rememberMe` must survive refresh-token rotation (i.e. rotating a "remembered" session keeps it at 90d, not reset to 7d).

---

### Task 1: Role-based access token expiry in `AuthService`

**Files:**
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts:200-213` (the `getExpirationByRole` method and the stale comment above it)
- Test: `apps/backend/src/modules/auth/application/auth.service.spec.ts:156-183` (update the three existing `'15m'` expiry tests — they currently assert the flat 15m behavior this task removes)

**Interfaces:**
- Produces: `getExpirationByRole(role: string): string` — now returns `'1h'` for `'USER'` and any unrecognized role, `'8h'` for `'ADMIN' | 'AGENT' | 'AGENT_OPERATIONAL_SUPPORT' | 'AGENT_ORACLE' | 'MANAGER'`. Signature unchanged; only the returned values change. Task 2 calls this exact method with no changes needed on its side.

- [ ] **Step 1: Update the three existing expiry tests to match the new contract**

Replace this block in `apps/backend/src/modules/auth/application/auth.service.spec.ts` (currently lines 156-183):

```ts
        it('should set 15m expiration for ADMIN users', async () => {
            const adminUser = { ...mockUser, role: 'ADMIN' };
            jwtService.sign.mockReturnValue('token');
            usersService.update.mockResolvedValue(adminUser as any);

            const result = await service.login(adminUser);

            expect(result.expiresIn).toBe('15m');
        });

        it('should set 15m expiration for AGENT users', async () => {
            const agentUser = { ...mockUser, role: 'AGENT' };
            jwtService.sign.mockReturnValue('token');
            usersService.update.mockResolvedValue(agentUser as any);

            const result = await service.login(agentUser);

            expect(result.expiresIn).toBe('15m');
        });

        it('should set 15m expiration for USER role', async () => {
            jwtService.sign.mockReturnValue('token');
            usersService.update.mockResolvedValue(mockUser as any);

            const result = await service.login(mockUser);

            expect(result.expiresIn).toBe('15m');
        });
```

with:

```ts
        it.each(['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE', 'MANAGER'])(
            'should set 8h expiration for %s users',
            async (role) => {
                const staffUser = { ...mockUser, role };
                jwtService.sign.mockReturnValue('token');
                usersService.update.mockResolvedValue(staffUser as any);

                const result = await service.login(staffUser);

                expect(result.expiresIn).toBe('8h');
            },
        );

        it('should set 1h expiration for USER role', async () => {
            jwtService.sign.mockReturnValue('token');
            usersService.update.mockResolvedValue(mockUser as any);

            const result = await service.login(mockUser);

            expect(result.expiresIn).toBe('1h');
        });
```

- [ ] **Step 2: Run tests to verify they fail (old implementation still returns `'15m'`)**

Run: `cd apps/backend && npx jest src/modules/auth/application/auth.service.spec.ts -t "expiration" -v`
Expected: FAIL — actual `expiresIn` is `'15m'`, not `'8h'`/`'1h'`.

- [ ] **Step 3: Implement role-based expiry**

In `apps/backend/src/modules/auth/application/auth.service.ts`, replace lines 200-207:

```ts
    /**
     * Get JWT expiration time based on user role
     * Admin/Agent: 3 hours for extended work sessions
     * User: 1 hour for security purposes
     */
    private getExpirationByRole(role: string): string {
        return '15m'; // M4: 15m access token for all roles
    }
```

with:

```ts
    private static readonly STAFF_ROLES = new Set([
        'ADMIN',
        'AGENT',
        'AGENT_OPERATIONAL_SUPPORT',
        'AGENT_ORACLE',
        'MANAGER',
    ]);

    /**
     * Access token expiry by role: staff roles get 8h for extended work
     * sessions, USER (and any unrecognized role) gets 1h.
     */
    private getExpirationByRole(role: string): string {
        return AuthService.STAFF_ROLES.has(role) ? '8h' : '1h';
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/backend && npx jest src/modules/auth/application/auth.service.spec.ts -v`
Expected: PASS, all tests including the new `it.each` block and the `1h` USER test.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/auth/application/auth.service.ts apps/backend/src/modules/auth/application/auth.service.spec.ts
git commit -m "feat(auth): role-based access token expiry (1h user, 8h staff)"
```

---

### Task 2: `rememberMe` extends refresh token to 90 days, survives rotation

**Files:**
- Modify: `apps/backend/src/modules/auth/application/auth.service.ts` — `login()` (currently lines 209-240) and `refreshToken()` (currently lines 242-255)
- Test: `apps/backend/src/modules/auth/application/auth.service.spec.ts` — new `describe('rememberMe', ...)` block inside the existing `describe('login', ...)` section

**Interfaces:**
- Consumes: `JwtService.sign(payload, opts)` (existing), `JwtService.verify(token)` (existing) — both already mocked in the test file's `beforeEach`.
- Produces: `login(user: any, request?: Request, rememberMe = false): Promise<{ access_token, refresh_token, user, expiresIn, refreshExpiresIn }>` — return object gains a new `refreshExpiresIn` field (`'7d'` or `'90d'`) that Task 3 (controller) reads to compute cookie `maxAge`. The refresh token JWT payload gains a `rememberMe: boolean` field. `refreshToken(token, request)` keeps its existing signature — it internally reads `rememberMe` off the decoded refresh payload and forwards it to `login()`.

- [ ] **Step 1: Write the failing tests**

Add this new `describe` block inside `describe('login', ...)` in `apps/backend/src/modules/auth/application/auth.service.spec.ts`, right after the existing `'should log audit for successful login'` test (before the closing `});` of the `login` describe block, i.e. before line 211 in the original file):

```ts
        describe('rememberMe', () => {
            it('defaults refreshExpiresIn to 7d when rememberMe is not passed', async () => {
                jwtService.sign.mockReturnValue('token');
                usersService.update.mockResolvedValue(mockUser as any);

                const result = await service.login(mockUser);

                expect(result.refreshExpiresIn).toBe('7d');
            });

            it('sets refreshExpiresIn to 90d when rememberMe is true', async () => {
                jwtService.sign.mockReturnValue('token');
                usersService.update.mockResolvedValue(mockUser as any);

                const result = await service.login(mockUser, undefined, true);

                expect(result.refreshExpiresIn).toBe('90d');
            });

            it('embeds rememberMe in the refresh token payload', async () => {
                jwtService.sign.mockReturnValue('token');
                usersService.update.mockResolvedValue(mockUser as any);

                await service.login(mockUser, undefined, true);

                expect(jwtService.sign).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'refresh', rememberMe: true }),
                    expect.objectContaining({ expiresIn: '90d' }),
                );
            });

            it('preserves rememberMe across refresh token rotation', async () => {
                jwtService.sign.mockReturnValue('new-token');
                jwtService.verify.mockReturnValue({
                    type: 'refresh',
                    sub: mockUser.id,
                    rememberMe: true,
                });
                usersService.getUserIfRefreshTokenMatches.mockResolvedValue(mockUser as any);
                usersService.update.mockResolvedValue(mockUser as any);

                const result = await service.refreshToken('old-refresh-token');

                expect(result.refreshExpiresIn).toBe('90d');
            });
        });
```

Also add `verify: jest.fn()` and `getUserIfRefreshTokenMatches: jest.fn()` to the mocks in `beforeEach` (top of the file):
- In the `JwtService` mock provider (currently `useValue: { sign: jest.fn() }`), change to `useValue: { sign: jest.fn(), verify: jest.fn() }`.
- In the `UsersService` mock provider, add `getUserIfRefreshTokenMatches: jest.fn(),` to the existing object (alongside `setCurrentRefreshToken: jest.fn(),`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && npx jest src/modules/auth/application/auth.service.spec.ts -t "rememberMe" -v`
Expected: FAIL — `result.refreshExpiresIn` is `undefined` (property doesn't exist yet), and `jwtService.sign` is not called with a `rememberMe` field.

- [ ] **Step 3: Implement `rememberMe` in `login()` and `refreshToken()`**

Replace the `login` method in `apps/backend/src/modules/auth/application/auth.service.ts` (currently lines 209-240):

```ts
    async login(user: any, request?: Request) {
        const payload = { username: user.email, sub: user.id, role: user.role, type: 'access', fullName: user.fullName };
        const refreshPayload = { username: user.email, sub: user.id, role: user.role, type: 'refresh', fullName: user.fullName };
        const expiresIn = this.getExpirationByRole(user.role);
        const refreshExpiresIn = '7d';

        // M2: Update lastActiveAt on login
        await this.usersService.update(user.id, { lastActiveAt: new Date() });

        const access_token = this.jwtService.sign(payload, { expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` });
        const refresh_token = this.jwtService.sign(refreshPayload, { expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` });
        
        await this.usersService.setCurrentRefreshToken(refresh_token, user.id);

        // Audit log for successful login
        this.auditService.logAsync({
            userId: user.id,
            action: AuditAction.USER_LOGIN,
            entityType: 'auth',
            entityId: user.id,
            description: `User ${user.fullName} logged in`,
            newValue: { email: user.email, role: user.role },
            request,
        });

        return {
            access_token,
            refresh_token, // Added refresh token
            user: user,
            expiresIn, // Return expiration info to frontend
        };
    }
```

with:

```ts
    async login(user: any, request?: Request, rememberMe = false) {
        const payload = { username: user.email, sub: user.id, role: user.role, type: 'access', fullName: user.fullName };
        const refreshPayload = { username: user.email, sub: user.id, role: user.role, type: 'refresh', fullName: user.fullName, rememberMe };
        const expiresIn = this.getExpirationByRole(user.role);
        const refreshExpiresIn = rememberMe ? '90d' : '7d';

        // M2: Update lastActiveAt on login
        await this.usersService.update(user.id, { lastActiveAt: new Date() });

        const access_token = this.jwtService.sign(payload, { expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` });
        const refresh_token = this.jwtService.sign(refreshPayload, { expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` });
        
        await this.usersService.setCurrentRefreshToken(refresh_token, user.id);

        // Audit log for successful login
        this.auditService.logAsync({
            userId: user.id,
            action: AuditAction.USER_LOGIN,
            entityType: 'auth',
            entityId: user.id,
            description: `User ${user.fullName} logged in`,
            newValue: { email: user.email, role: user.role },
            request,
        });

        return {
            access_token,
            refresh_token, // Added refresh token
            user: user,
            expiresIn, // Return expiration info to frontend
            refreshExpiresIn,
        };
    }
```

Replace the `refreshToken` method (currently lines 242-255):

```ts
    async refreshToken(token: string, request?: Request) {
        try {
            const decoded = this.jwtService.verify(token);
            if (decoded.type !== 'refresh') throw new UnauthorizedException('Invalid token type');
            
            const user = await this.usersService.getUserIfRefreshTokenMatches(token, decoded.sub);
            if (!user) throw new UnauthorizedException('Invalid refresh token');

            // Rotate tokens by calling login again
            return this.login(user, request);
        } catch(e) {
            throw new UnauthorizedException('Refresh token is invalid or expired');
        }
    }
```

with:

```ts
    async refreshToken(token: string, request?: Request) {
        try {
            const decoded = this.jwtService.verify(token);
            if (decoded.type !== 'refresh') throw new UnauthorizedException('Invalid token type');
            
            const user = await this.usersService.getUserIfRefreshTokenMatches(token, decoded.sub);
            if (!user) throw new UnauthorizedException('Invalid refresh token');

            // Rotate tokens by calling login again, preserving rememberMe
            return this.login(user, request, decoded.rememberMe === true);
        } catch(e) {
            throw new UnauthorizedException('Refresh token is invalid or expired');
        }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/backend && npx jest src/modules/auth/application/auth.service.spec.ts -v`
Expected: PASS, all tests (18 pre-existing + 4 new `rememberMe` tests + the `it.each` from Task 1).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/auth/application/auth.service.ts apps/backend/src/modules/auth/application/auth.service.spec.ts
git commit -m "feat(auth): rememberMe extends refresh token to 90d, survives rotation"
```

---

### Task 3: Controller passes `rememberMe` through and uses dynamic cookie `maxAge`

**Files:**
- Modify: `apps/backend/src/modules/auth/presentation/auth.controller.ts` — `login()` (currently lines 26-60) and `refresh()` (currently lines 87-115)

**Interfaces:**
- Consumes: `authService.login(user, request, rememberMe)` and the `result.refreshExpiresIn` field from Task 2.
- Produces: no new exported interface — this is the terminal task wiring service output to HTTP response. Behavior: refresh-token cookie `maxAge` now reflects `7d` or `90d` dynamically instead of the hardcoded `7 * 24 * 60 * 60 * 1000`.

There is no existing controller test file for `auth.controller.ts` (verified: no `apps/backend/src/modules/auth/presentation/**/*.spec.ts` exists), so this task is verified by manual/integration means (Step 3 below) rather than a new unit test file — consistent with YAGNI (don't scaffold a new test file/harness for one controller method when the underlying logic is already fully covered by Task 2's service-level tests).

- [ ] **Step 1: Update `login()` to read `rememberMe` from the request body and use dynamic refresh cookie `maxAge`**

Replace in `apps/backend/src/modules/auth/presentation/auth.controller.ts` (currently lines 31-59):

```ts
    async login(@Request() req: any, @Res() res: Response) {
        const result = await this.authService.login(req.user, req);

        // Calculate cookie maxAge based on expiresIn (e.g., '3h' -> 3*60*60*1000)
        const expiresIn = result.expiresIn;
        const maxAgeMs = this.parseExpiresIn(expiresIn);

        // Set HttpOnly cookie with the token
        res.cookie(COOKIE_NAME, result.access_token, {
            ...COOKIE_OPTIONS,
            maxAge: maxAgeMs,
        });

        // Set refresh token in HttpOnly cookie
        res.cookie('refresh_token', result.refresh_token, {
            ...COOKIE_OPTIONS,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Set CSRF token cookie after successful login
        // This allows subsequent state-changing requests to include the token
        setCsrfCookie(res);

        // Return user data without token (token is in HttpOnly cookie)
        return res.json({
            user: result.user,
            expiresIn: result.expiresIn,
            expiresAt: new Date(Date.now() + maxAgeMs).toISOString(),
        });
    }
```

with:

```ts
    async login(@Request() req: any, @Res() res: Response) {
        const rememberMe = req.body?.rememberMe === true;
        const result = await this.authService.login(req.user, req, rememberMe);

        // Calculate cookie maxAge based on expiresIn (e.g., '8h' -> 8*60*60*1000)
        const expiresIn = result.expiresIn;
        const maxAgeMs = this.parseExpiresIn(expiresIn);
        const refreshMaxAgeMs = this.parseExpiresIn(result.refreshExpiresIn);

        // Set HttpOnly cookie with the token
        res.cookie(COOKIE_NAME, result.access_token, {
            ...COOKIE_OPTIONS,
            maxAge: maxAgeMs,
        });

        // Set refresh token in HttpOnly cookie
        res.cookie('refresh_token', result.refresh_token, {
            ...COOKIE_OPTIONS,
            maxAge: refreshMaxAgeMs,
        });

        // Set CSRF token cookie after successful login
        // This allows subsequent state-changing requests to include the token
        setCsrfCookie(res);

        // Return user data without token (token is in HttpOnly cookie)
        return res.json({
            user: result.user,
            expiresIn: result.expiresIn,
            expiresAt: new Date(Date.now() + maxAgeMs).toISOString(),
        });
    }
```

- [ ] **Step 2: Update `refresh()` to use dynamic refresh cookie `maxAge`**

Replace in `apps/backend/src/modules/auth/presentation/auth.controller.ts` (currently lines 91-114):

```ts
    async refresh(@Request() req: any, @Res() res: Response) {
        const refreshToken = req.cookies?.refresh_token;
        if (!refreshToken) {
           return res.status(401).json({ message: 'No refresh token provided' });
        }
        
        const result = await this.authService.refreshToken(refreshToken, req);
        
        const maxAgeMs = this.parseExpiresIn(result.expiresIn);
        res.cookie(COOKIE_NAME, result.access_token, {
            ...COOKIE_OPTIONS,
            maxAge: maxAgeMs,
        });
        
        res.cookie('refresh_token', result.refresh_token, {
            ...COOKIE_OPTIONS,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        
        return res.json({
            user: result.user,
            expiresIn: result.expiresIn,
            expiresAt: new Date(Date.now() + maxAgeMs).toISOString(),
        });
    }
```

with:

```ts
    async refresh(@Request() req: any, @Res() res: Response) {
        const refreshToken = req.cookies?.refresh_token;
        if (!refreshToken) {
           return res.status(401).json({ message: 'No refresh token provided' });
        }
        
        const result = await this.authService.refreshToken(refreshToken, req);
        
        const maxAgeMs = this.parseExpiresIn(result.expiresIn);
        const refreshMaxAgeMs = this.parseExpiresIn(result.refreshExpiresIn);
        res.cookie(COOKIE_NAME, result.access_token, {
            ...COOKIE_OPTIONS,
            maxAge: maxAgeMs,
        });
        
        res.cookie('refresh_token', result.refresh_token, {
            ...COOKIE_OPTIONS,
            maxAge: refreshMaxAgeMs,
        });
        
        return res.json({
            user: result.user,
            expiresIn: result.expiresIn,
            expiresAt: new Date(Date.now() + maxAgeMs).toISOString(),
        });
    }
```

- [ ] **Step 3: Verify `parseExpiresIn` already handles `'90d'` and `'8h'` (no change needed, confirm by reading)**

Read `apps/backend/src/modules/auth/presentation/auth.controller.ts` lines 144-164 (the `parseExpiresIn` method) and confirm the regex `/^(\d+)([smhd])$/` and the `case 'd': return value * 24 * 60 * 60 * 1000;` / `case 'h': return value * 60 * 60 * 1000;` branches already cover `'90d'` and `'8h'` — no edit required here.

- [ ] **Step 4: Build backend to catch type errors**

Run: `cd apps/backend && npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Run full auth test suite as a regression check**

Run: `cd apps/backend && npx jest src/modules/auth -v`
Expected: all suites PASS (includes `auth.service.spec.ts`, `auth.service.hris.spec.ts`).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/auth/presentation/auth.controller.ts
git commit -m "feat(auth): controller forwards rememberMe and uses dynamic refresh cookie maxAge"
```

---

### Task 4: Frontend sends `rememberMe` on login

**Files:**
- Modify: `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx:94`
- Test: `apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx:60-77` (the existing `it.each` asserting the `api.post` call body)

**Interfaces:**
- Consumes: existing `rememberMe` state (`BentoLoginPage.tsx:22`) and its checkbox binding (`BentoLoginPage.tsx:269-270`) — both already present, unchanged.
- Produces: `api.post('/auth/login', { email, password, rememberMe })` — the request body gains one field. No other code in the codebase reads this response shape, so no downstream consumers are affected.

- [ ] **Step 1: Update the failing test first**

Replace in `apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx` (currently lines 60-77):

```tsx
  it.each([
    ['admin@example.com', 'password123'],
    ['00000024', '123456'],
  ])('calls api.post with identifier %s and password', async (email, password) => {
    mockApi.post.mockResolvedValue({ data: { user: { role: 'ADMIN' } } });
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), email);
    await user.type(screen.getByLabelText('Password'), password);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email, password });
    });
  });
```

with:

```tsx
  it.each([
    ['admin@example.com', 'password123'],
    ['00000024', '123456'],
  ])('calls api.post with identifier %s and password', async (email, password) => {
    mockApi.post.mockResolvedValue({ data: { user: { role: 'ADMIN' } } });
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), email);
    await user.type(screen.getByLabelText('Password'), password);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email, password, rememberMe: false });
    });
  });

  it('sends rememberMe: true when "Keep session active" is checked', async () => {
    mockApi.post.mockResolvedValue({ data: { user: { role: 'ADMIN' } } });
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('NIK / Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByLabelText(/keep session active/i));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@example.com',
        password: 'password123',
        rememberMe: true,
      });
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/frontend && npx vitest run src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx`
Expected: FAIL — current call is `{ email, password }` without `rememberMe`, and the checkbox has no accessible label match yet (verify in Step 3 if the label needs an `htmlFor`/`id` pairing — see note below).

- [ ] **Step 3: Check checkbox accessibility binding before relying on `getByLabelText`**

Read `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx` lines 265-277. The checkbox `<input type="checkbox">` is wrapped in a `<label>` containing both the input and the text "Keep session active" — this wrapping pattern already makes it accessible via `getByLabelText(/keep session active/i)` in Testing Library without needing an explicit `id`/`htmlFor` pair (wrapped inputs are implicitly associated with their label). No markup change needed; this step is a verification read, not an edit.

- [ ] **Step 4: Implement — send `rememberMe` in the login request**

In `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx`, replace line 94:

```ts
            const res = await api.post('/auth/login', { email, password });
```

with:

```ts
            const res = await api.post('/auth/login', { email, password, rememberMe });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/frontend && npx vitest run src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx`
Expected: PASS, all tests including the two updated/new `rememberMe` assertions.

- [ ] **Step 6: Run the full frontend auth test directory as a regression check**

Run: `cd apps/frontend && npx vitest run src/features/auth`
Expected: all suites PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/auth/pages/BentoLoginPage.tsx apps/frontend/src/features/auth/pages/__tests__/BentoLoginPage.integration.test.tsx
git commit -m "feat(auth): wire up 'Keep session active' checkbox to send rememberMe on login"
```
