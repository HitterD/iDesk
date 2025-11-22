# System QA & Sanity Check - Manual Verification

## 1. The Fix List (Audit Results)

| Component | Issue | Fix Applied | Status |
| :--- | :--- | :--- | :--- |
| **Backend CORS** | `origin: '*'` was insecure | Changed to `origin: 'http://localhost:4050'` in `main.ts` | ✅ Fixed |
| **Static Assets** | `/uploads` folder missing caused crash | Added `fs.mkdirSync('./uploads')` check in `main.ts` | ✅ Fixed |
| **Socket.io** | Default CORS blocked frontend | Added `cors: { origin: 'http://localhost:4050', credentials: true }` in `EventsGateway` | ✅ Fixed |
| **JWT Strategy** | Potential hardcoded secret | Verified `process.env.JWT_SECRET` usage in `JwtStrategy` and `AuthModule` | ✅ Verified |
| **Frontend Env** | Hardcoded API URL | Verified `import.meta.env.VITE_API_URL` usage in `api.ts` | ✅ Verified |

## 2. QA Checklist Manual (Test Scenarios)

Perform these tests manually to ensure system stability.

| ID | Scenario | Action | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **QA-01** | **Login Failure** | Attempt login with invalid credentials | Toast Error: "Invalid credentials" (or similar) | [ ] |
| **QA-02** | **Login Success** | Login with valid Admin credentials | Redirect to Dashboard; Token stored in LocalStorage | [ ] |
| **QA-03** | **CORS Protection** | Access `http://localhost:5050/api/users` from a different origin (e.g., Postman without Origin header) | Should work if Postman (no origin enforcement) but fail if called from a malicious site (browser enforces) | [ ] |
| **QA-04** | **File Upload** | Create a ticket and attach a file | File saved in `/uploads`; No server crash | [ ] |
| **QA-05** | **Real-time Update** | Open two browsers. Update ticket status in one. | Status updates instantly in the second browser via Socket.io | [ ] |
| **QA-06** | **Page Refresh** | Refresh the page while logged in | User remains logged in (Session persistence) | [ ] |
| **QA-07** | **Logout** | Click Logout button | Redirect to Login; LocalStorage cleared | [ ] |
