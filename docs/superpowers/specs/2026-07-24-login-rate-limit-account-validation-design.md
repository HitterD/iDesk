# Login Rate Limit Persistence & Account Validation Design Spec

## Overview
This design spec addresses two key enhancements on the iDesk login page (`BentoLoginPage`):
1. **Rate Limit Persistence Across Page Refresh**: Persisting active rate limit countdown timers in `localStorage` keyed by user account identifier (NIK or Email), ensuring refreshing the browser window does not reset or bypass the live countdown timer.
2. **Dual-Language Account Not Found Notification**: Displaying an explicit, user-friendly dual-language error message when an entered NIK or Email is not registered in the system (`USER_NOT_FOUND`).

---

## 1. Rate Limit Persistence Design

### Keying & Storage Format
- **Storage Key**: `idesk_rl_<normalized_identifier>`
  - `<normalized_identifier>`: Trimmed, lowercased user NIK or Email string (e.g. `idesk_rl_user@idesk.com` or `idesk_rl_00000024`).
- **Value**: Unix timestamp (milliseconds) representing the exact expiry time when the rate limit window ends (`expiryTimestamp = Date.now() + seconds * 1000`).

### Lifecycle & Flow
1. **Rate Limit Trigger (429 Status)**:
   - When API returns HTTP 429, extract `retry-after` header value (or default to 60s).
   - Compute `expiryTimestamp = Date.now() + seconds * 1000`.
   - Store `expiryTimestamp` in `localStorage` under `idesk_rl_<normalized_identifier>`.
   - Initialize React state `rateLimitSeconds = seconds`.
2. **Page Mount / Identifier Change Check**:
   - Whenever the `email` (NIK/Email) input value changes or component mounts:
     - Read `localStorage.getItem('idesk_rl_<normalized_identifier>')`.
     - If key exists and `expiryTimestamp > Date.now()`:
       - Calculate `remainingSeconds = Math.ceil((expiryTimestamp - Date.now()) / 1000)`.
       - Set `rateLimitSeconds = remainingSeconds` to restore the live countdown.
     - If `expiryTimestamp <= Date.now()`:
       - Remove key from `localStorage`.
3. **Countdown Completion**:
   - When `rateLimitSeconds` ticks down to 0, clean up the corresponding `localStorage` key and re-enable form submission.

---

## 2. Dual-Language Account Validation Design

### Error Code Mapping (`USER_NOT_FOUND`)
In `loginErrorMapping.ts`:
- **Error Code**: `USER_NOT_FOUND`
- **Type**: `'error'`
- **Message**: `"Account not found"`
- **Details**: `"NIK atau email tidak terdaftar dalam sistem iDesk."`

### Behavior
- When a user enters an un-registered NIK or Email address:
  - Backend returns HTTP 401 with `errorCode: 'USER_NOT_FOUND'`.
  - Frontend displays the red error alert banner:
    - **Header**: `Account not found`
    - **Body**: `NIK atau email tidak terdaftar dalam sistem iDesk.`

---

## 3. Coexistence of Error & Rate Limit Banners
- The UI renders both:
  1. **Rate Limit Warning Banner**: Amber alert box with live ticking countdown (`Wait X seconds.`).
  2. **Error Banner**: Red alert box with specific failure details (`Account not found` or `Incorrect password - X attempts remaining.`).

---

## Verification & Testing Strategy
1. **Unit Tests**:
   - `loginErrorMapping.test.ts`: Verify `USER_NOT_FOUND` returns dual-language text (`Account not found` + `NIK atau email tidak terdaftar dalam sistem iDesk.`).
2. **Integration Tests**:
   - `BentoLoginPage.integration.test.tsx`:
     - Test that receiving 429 writes `expiryTimestamp` to `localStorage` and restores countdown upon page refresh / remount.
     - Test that entering un-registered NIK/email renders `Account not found` with `NIK atau email tidak terdaftar dalam sistem iDesk.`.
