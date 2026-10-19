# Sign in with iPop

iPop is an OpenID Connect provider; iDesk is the confidential client `idesk`. People sign in to iDesk with their iPop
account, and links from iPop / iPop Notifier open iDesk already signed in.

## What it does

| Path | Behaviour |
|---|---|
| **Masuk dengan iPop** button on `/login` | `GET /api/v1/auth/oidc/start?returnTo=/…` → iPop `/connect/authorize` (code + PKCE S256) → `GET /api/v1/auth/oidc/callback` → normal iDesk session cookies ("remember me") → `returnTo`. Someone already signed in to iPop comes straight back without a prompt. |
| NIK + **iPop password** in the normal form | The existing HRIS/local check runs first. Only if it fails does the backend try iPop's password grant (`grant_type=password`). The iDesk password keeps working, and iPop never sees failed attempts from people still typing their iDesk password. |
| Email + iDesk password | Unchanged. |
| "Open in iDesk" from iPop / Notifier | Link to `/api/v1/auth/oidc/start?returnTo=/tickets/4821`. |

Account matching (`IpopAccountLinker`): by NIK (`users.employeeId`) first. An account **without** a NIK whose email
equals the iPop email is linked once (`employeeId` set, `USER_UPDATE` audit row). No match → no new account; the login
page shows "Akun iDesk belum terhubung — hubungi ICT". A different existing NIK is never overwritten (`NIK_CONFLICT`,
logged as `LOGIN_FAILED`). Disabled accounts stay disabled.

Signing in through iPop skips iDesk's "must change password" dialog: iPop checked the password, and the iDesk one was
not used.

## Configuration

Backend env (also wired in `docker-compose.prod.yml`):

| Variable | Example | Notes |
|---|---|---|
| `IPOP_OIDC_ISSUER` | `https://ipop.santos.co.id` | Discovery: `<issuer>/.well-known/openid-configuration` |
| `IPOP_OIDC_CLIENT_ID` | `idesk` | |
| `IPOP_OIDC_CLIENT_SECRET` | *(from ICT)* | **Empty = feature off and button hidden.** Never commit it. |
| `IPOP_OIDC_REDIRECT_URI` | `https://idesk.santos.co.id/api/v1/auth/oidc/callback` | Must be registered in iPop exactly. |
| `IPOP_OIDC_PASSWORD_LOGIN` | `true` | `false` = only the button, no NIK + iPop password in the form. |

iPop side (`appsettings.Local.json` on the iPop server, not in git):

```json
"Oidc": {
  "Enabled": true,
  "Issuer": "https://ipop.santos.co.id",
  "Clients": [ {
    "ClientId": "idesk", "DisplayName": "iDesk", "ClientSecret": "<same secret>",
    "RedirectUris": ["https://idesk.santos.co.id/api/v1/auth/oidc/callback"],
    "PostLogoutRedirectUris": ["https://idesk.santos.co.id/login"],
    "AllowPassword": true
  } ]
}
```

## Security notes

- `state`, `nonce` and the PKCE verifier travel in a 5-minute HttpOnly cookie (`ipop_oidc`) signed with `JWT_SECRET`;
  the callback refuses a missing/expired/mismatched one.
- The ID token is verified against iPop's JWKS (RS256, `iss`, `aud=idesk`, `exp`, `nonce`) using `jose`.
- `returnTo` accepts only same-origin relative paths (`safeReturnTo`).
- The iPop password is passed to iPop and dropped: not stored, not logged, and iPop's tokens are not kept.
- `oidc/start` and `oidc/callback` are not throttled (no password is checked there, and the office shares one NAT IP).
  The form path keeps `/auth/login`'s throttle, and iPop applies its own per-NIK lockout.
- Errors reach the login page as `?sso_error=` codes: `ipop_not_linked`, `account_disabled`, `ipop_denied`,
  `ipop_expired`, `ipop_unavailable`, `ipop_disabled`, `ipop_failed`.

## Test checklist

- [ ] Button → iPop login (when not signed in to iPop) → back on iDesk as the right person.
- [ ] Already signed in to iPop → button signs in without a prompt.
- [ ] `oidc/start?returnTo=/tickets/<id>` lands on that ticket.
- [ ] NIK + iPop password in the form works; a wrong password shows the usual error.
- [ ] NIK + old iDesk password and email + iDesk password still work.
- [ ] Account without NIK but with the same email → linked once (audit row), next time matched by NIK.
- [ ] No match → "Akun iDesk belum terhubung"; no account created.
- [ ] `returnTo=//evil.example` → lands on `/`.
- [ ] Callback with a tampered `state` or after 5 minutes → "Sesi masuk iPop kedaluwarsa".
- [ ] `IPOP_OIDC_CLIENT_SECRET` empty → no button, `/auth/oidc/start` → `?sso_error=ipop_disabled`.

The old SJA Notifier routes (`s2s/issue-sso-ticket`, `autologin`) remain until SJA Notifier is switched off.
