# API Route Inventory

## Route security baseline

| Route group | Auth policy | Evidence |
|---|---|---|
| `/health/live` | Public liveness only | `HealthController.live()` uses `@Public()` |
| `/health`, `/health/detailed`, `/health/metrics`, `/health/services`, `/health/incidents`, `/health/ready` | JWT + ADMIN | `HealthController` class guards/role |
| `/auth/login`, `/auth/refresh`, `/auth/csrf-token` | Explicit public auth entrypoints | `AuthController`; login uses `LocalAuthGuard` |
| `/auth/register` | JWT + ADMIN (closed to anonymous) | `AuthController.register()` uses `@UseGuards(JwtAuthGuard, RolesGuard) @Roles(ADMIN)` + `@Throttle(3/min)` |
| `/auth/register` (role handling) | Role is pinned to `USER` server-side; not caller-controlled | `RegisterDto` omits `role`; `AuthService.register()` forces `UserRole.USER`. Elevation is admin-only via `POST /users` / `PATCH /users/:id/role` |
| `/auth/logout`, `/auth/change-password` | JWT | `AuthController` method guards |
| `/departments` | JWT + ADMIN/MANAGER | `DepartmentsController` class guards/roles |
| `/telegram/webhook` | Public provider webhook; provider processing validates update path | `TelegramController.handleWebhook()` |
| `/telegram/webapp/ticket`, `/telegram/webapp/tickets` | Telegram init-data validation in controller | `WebAppController` |
| `/telegram/webapp/health` | Public health response | `WebAppController.health()` |
| `/surveys/submit`, `/lost-item/qr/:token`, `/tv/board/:token` | Explicit public token routes | `@Public()` decorators |
| `DELETE /tickets/bulk` | ADMIN-only soft delete; requires `BulkDeleteTicketsDto` (array of UUIDs, max 100); returns `{ deleted, failed }`; site-isolated (fail-closed); audit logged | `TicketsController.bulkDelete()` + `TicketUpdateService.bulkSoftDelete()` |
| Other controller routes | Explicit JWT/role/page guards in controller inventory | Source scan; runtime anonymous E2E remains pending |

## Versioning

`main.ts` enables URI versioning with default version `1`; frontend uses `/v1`. Representative route compatibility and generated Swagger need runtime E2E evidence before release approval.

## Boundary decision

No global `APP_GUARD` JWT policy added in this pass. Controllers use explicit `JwtAuthGuard`; `@Public()` is reserved for liveness and intentional token/provider routes. Full anonymous integration inventory remains a release-gate task.
