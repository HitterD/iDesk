# iPop -> iDesk integration (plan)

Agreed in /grill-me on 2026-10-04. iPop (ipop.santos.co.id, .NET 10) creates iDesk tickets
and tracks their progress; chat and details stay in iDesk.

## Decisions
- Auth: dedicated iPop client. HMAC-SHA256 over `${timestamp}.${rawBody}` with its own secret
  (`IPOP_CLIENT_ID`, `IPOP_CLIENT_SECRET`), +-5 min window, rate limited. Raw body is captured
  in `main.ts` (`express.json({ verify })`) so the signature covers the exact bytes sent.
- Requester = the iPop user, matched by `employeeId` (NIK) or `email` to an active iDesk user;
  unknown/inactive -> 422.
- Routing: iPop sends `module` (slug). The module decides `handlingTeam` + `ticketType`, so the
  ticket lands in the queue the user picked. Category must belong to the module, else 400.
  - it-support: categories GENERAL/HARDWARE/SOFTWARE/NETWORK/HARDWARE_INSTALLATION + enabled
    `ticket_attributes` CATEGORY values (same list as the web form).
  - oracle-k2 / web-developer / mobile-developer: category fixed to the module's request type,
    same as the web form (ORACLE_REQUEST / WEB_DEV_REQUEST / MOBILE_DEV_REQUEST).
  - Hardware installation: same fields/validation as the web form.
- Idempotency: `externalSource` + `externalRef` (unique together). A repeat returns the
  existing ticket (200) instead of creating another.
- `source = IPOP` (new enum value) + "via iPop" badge in the iDesk UI.
- Tracking: `GET /integrations/ipop/tickets/:ticketNumber`, `GET .../tickets?externalRef=|nik=`.
  Only tickets with `externalSource = 'IPOP'`. Fields: number, status, priority, module,
  category, assignee name, SLA target, created/resolved/closed times, iDesk URL. No chat,
  attachments or internal notes.
- Webhook to `IPOP_WEBHOOK_URL` (HMAC-signed with the same secret): `ticket.created`,
  `ticket.assigned`, `ticket.status_changed`, `ticket.resolved`, `ticket.closed`. Outbox table
  with retries at +1m, +5m, +30m, +2h, then FAILED.
- Notifications to the requester are unchanged (same as web tickets).
- Scope of this work: iDesk side + docs with C# signing/webhook samples. iPop code later.

## Steps
1. Migration: `tickets.externalSource`, `tickets.externalRef` (+ partial unique index),
   `tickets_source_enum` += 'IPOP', table `integration_webhook_outbox`.
2. `modules/integrations/ipop`: HMAC guard, DTOs, module catalog service, create service
   (reuses TicketCreateService), tracking service, controller, webhook outbox + dispatcher cron,
   event listeners.
3. Frontend: "via iPop" badge where the ticket source is shown.
4. Tests: guard, routing/category validation, idempotency, requester match, tracking scope,
   webhook signing/retry.
5. Docs: `docs/integrations/ipop-api.md` with request/response examples and C# samples.
