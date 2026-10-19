# iDesk API for iPop

iPop (`https://ipop.santos.co.id`) creates iDesk tickets and shows their progress.
iPop is told when a new chat message arrives (a short preview, section 5.1) and can read
the public conversation (section 4.1), but replying, adding attachments and reopening
always happen in iDesk; every ticket carries a link to open it there. Internal notes
never leave iDesk.

iPop also sees tickets the user filed **directly in iDesk**. They are linked by the
requester's NIK (shared with iPop through HRIS) and appear with `origin: "IDESK"` and
`externalRef: null`. Requesters without a NIK, and ticket types hidden from the requester's
"My Tickets" in iDesk (ICT budget, automatic hardware-installation tickets), are not shared.

- Base URL: `https://idesk.santos.co.id/api/v1/integrations/ipop`
- Format: JSON (UTF-8) in both directions
- Rate limit: 120 requests per minute
- Zoom bookings for the iPop calendar: section 7

## 1. Authentication (every request)

Each request carries three headers:

| Header | Value |
|---|---|
| `x-ipop-client-id` | the client id issued by iDesk (`IPOP_CLIENT_ID`) |
| `x-ipop-timestamp` | current time, Unix epoch **milliseconds** |
| `x-ipop-signature` | hex `HMAC-SHA256(secret, "<timestamp>.<raw body>")` |

- Sign the **exact bytes** you send. For `GET` the body is the empty string.
- iDesk rejects timestamps more than 5 minutes off its clock, so keep the server on NTP.
- Wrong or missing headers -> `401`. iDesk not configured -> `503`.

### C# (.NET) signing

```csharp
using System.Security.Cryptography;
using System.Text;

public sealed class IDeskSigningHandler(string clientId, string secret) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var signature = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{timestamp}.{body}"))).ToLowerInvariant();

        request.Headers.Add("x-ipop-client-id", clientId);
        request.Headers.Add("x-ipop-timestamp", timestamp);
        request.Headers.Add("x-ipop-signature", signature);
        return await base.SendAsync(request, ct);
    }
}

// Program.cs
builder.Services.AddHttpClient("idesk", c => c.BaseAddress = new Uri("https://idesk.santos.co.id/api/v1/integrations/ipop/"))
    .AddHttpMessageHandler(() => new IDeskSigningHandler(cfg["IDesk:ClientId"]!, cfg["IDesk:ClientSecret"]!));
```

Send the body as a string you serialise yourself (e.g. `new StringContent(json, Encoding.UTF8, "application/json")`),
so the bytes you sign are the bytes on the wire.

## 2. `GET /modules`

The queues a user may pick, with their categories. Use it to fill the iPop dropdowns.

```json
[
  { "slug": "it-support", "name": "IT Support Tickets", "description": null,
    "categories": ["GENERAL", "HARDWARE", "SOFTWARE", "NETWORK", "HARDWARE_INSTALLATION"],
    "defaultCategory": null, "priorities": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    "supportsHardwareInstallation": true },
  { "slug": "oracle-k2", "name": "Oracle K2 Request", "categories": ["ORACLE_REQUEST"],
    "defaultCategory": "ORACLE_REQUEST", "priorities": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    "supportsHardwareInstallation": false }
]
```

The module the user picks decides the queue: `it-support` -> IT Support, `oracle-k2` -> Oracle/K2,
`web-developer` -> Web Developer, `mobile-developer` -> Mobile Developer.

## 3. `POST /tickets`

```json
{
  "externalRef": "IPOP-REQ-2026-000123",
  "module": "it-support",
  "category": "NETWORK",
  "priority": "HIGH",
  "title": "Wifi lantai 2 mati",
  "description": "Tidak bisa konek sejak pagi, sudah restart laptop.",
  "requester": { "nik": "00000024" },
  "device": "Laptop",
  "attachments": [ { "fileName": "screenshot.png", "contentBase64": "iVBORw0KGgo..." } ]
}
```

| Field | Rules |
|---|---|
| `externalRef` | **Required.** iPop's own id, 1-100 chars `[A-Za-z0-9._:-/]`. Sending the same value again returns the existing ticket. |
| `module` | Required. A `slug` from `/modules`. |
| `category` | Required for `it-support` (one of its categories). Optional for developer modules (only their own value is accepted). |
| `priority` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. |
| `title` | 5-200 chars. `description`: 3-5000 chars. |
| `requester` | `nik` (preferred) or `email` of a user that exists and is active in iDesk. |
| `criticalReason` | Required when `priority` is `CRITICAL` (3-500 chars). |
| `device`, `software` | Optional, max 100 chars. |
| `attachments` | Optional, up to 5 files, 10 MB each after decoding. Same file types as the iDesk web form; content must match the extension. |
| `scheduledDate`, `scheduledTime`, `hardwareType` | Required when `category` is `HARDWARE_INSTALLATION`: date `YYYY-MM-DD`, slot `08:00`-`11:00` or `14:00`-`15:00` on the hour. |

Responses:

- `201` with the ticket (below): created.
- `200` with the ticket: a ticket already exists for this `externalRef`. Safe to retry after a timeout.
- `400`: validation error, e.g. unknown module, or a category that does not belong to the module.
- `422`: requester not registered or inactive in iDesk.

## 4. Ticket progress

- `GET /tickets/{ticketNumber}`: any ticket iPop may see (iPop- or iDesk-filed).
- `GET /tickets?externalRef=...`: tickets filed through iPop only.
- `GET /tickets?nik=...&state=open|all`: all tickets of that requester, iPop- and iDesk-filed
  (newest first, max 100). Use it for the initial sync when a user opens their ticket page:
  tickets that existed before the integration went live are not pushed by webhook.

```json
{
  "ticketId": "bb4ed960-03e1-4428-8f64-136f60340381",
  "ticketNumber": "041026-INS-0001",
  "externalRef": "IPOP-REQ-2026-000123",
  "origin": "IPOP",
  "requester": { "nik": "00000024", "name": "Budi" },
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "module": "it-support",
  "category": "NETWORK",
  "title": "Wifi lantai 2 mati",
  "assignee": { "name": "Agent Name" },
  "slaTarget": "2026-10-04T09:00:00.000Z",
  "visit": null,
  "createdAt": "2026-10-04T01:00:00.000Z",
  "updatedAt": "2026-10-04T02:10:00.000Z",
  "resolvedAt": null,
  "closedAt": null,
  "url": "https://idesk.santos.co.id/client/tickets/bb4ed960-03e1-4428-8f64-136f60340381"
}
```

`status`: `TODO` (open) -> `IN_PROGRESS` -> `WAITING_VENDOR` -> `RESOLVED` (waiting for the
requester to confirm in iDesk) -> `CLOSED` (final). `CANCELLED` is final too.

`visit`: the ICT visit of a hardware-installation ticket, `null` for every other ticket or
while no slot is set. Times are UTC; iDesk books slots in WIB. One hour unless the slot has
an end (installs from a hardware request, e.g. `09.00 - 11.00`).

```json
"visit": { "start": "2026-10-13T02:00:00.000Z", "end": "2026-10-13T03:00:00.000Z", "hardwareType": "PRINTER" }
```

Put it on the requester's calendar (`requester.nik`), keyed by `ticketId`. When the visit is
rescheduled iDesk sends `ticket.visit_changed` (section 5); when the ticket is cancelled or
closed, remove it or mark it done.

### 4.1 `GET /tickets/{ticketNumber}/messages`

The public conversation of a ticket iPop may see, oldest first (the latest 200), as plain
text. Internal notes and system messages are never included. Attachments are listed by
name only; opening them and adding files happen in iDesk (`url`). Text replies can be sent
from iPop with section 4.2.

```json
{
  "ticketNumber": "041026-INS-0001",
  "url": "https://idesk.santos.co.id/client/tickets/bb4ed960-03e1-4428-8f64-136f60340381",
  "messages": [
    { "id": "1a2b....", "sender": { "name": "Budi" }, "fromRequester": true,
      "content": "Tidak bisa konek sejak pagi, sudah restart laptop.", "attachments": [],
      "createdAt": "2026-10-11T01:02:00.000Z" },
    { "id": "5c1e....", "sender": { "name": "Agent Name" }, "fromRequester": false,
      "content": "Sudah saya cek.
Mohon restart laptop Anda lalu coba lagi.",
      "attachments": [ { "name": "reset-wifi.pdf" } ], "createdAt": "2026-10-11T03:00:00.000Z" }
  ]
}
```

- `content` keeps line breaks (`
`); markup is removed.
- `fromRequester`: the requester's own messages (show them on "my" side of the chat).
- Senders are given by name only, never by NIK.
- `404` when the ticket does not exist or is not shared with iPop.

### 4.2 `POST /tickets/{ticketNumber}/messages`

A text reply typed in the iPop Notifier (Windows toast), posted as the person with that NIK
through iDesk's normal reply path: the same chat, events, SLA clock and notifications as a
message typed in iDesk.

```json
{ "nik": "00061058", "content": "Siap, saya cek sekarang." }
```

- Allowed for the ticket's requester side (requester, the staff who filed it, participants)
  and the **assigned agent**. Anyone else: `403`.
- `422` when the NIK has no active iDesk account; `404` when the ticket is not shared with iPop;
  `400` for an empty message or a closed ticket.
- Plain text only, at most 4000 characters. Files are added in iDesk.
- Answer `201`: `{ "id": "…", "createdAt": "…" }`.

## 5. Webhook (iDesk -> iPop)

iDesk POSTs to `IPOP_WEBHOOK_URL` (e.g. `https://ipop.santos.co.id/api/idesk/webhook`) with the
same three headers, signed with the same secret. Verify the signature and timestamp before
trusting the body, and answer `2xx` quickly.

```json
{
  "id": "4f0c6a1e-....",
  "event": "ticket.status_changed",
  "occurredAt": "2026-10-04T02:10:00.000Z",
  "previousStatus": "TODO",
  "ticket": { "...": "same shape as section 4" }
}
```

Events: `ticket.created`, `ticket.assigned` (`previousAssignee`), `ticket.status_changed`,
`ticket.resolved`, `ticket.closed` (all three with `previousStatus`), `ticket.message_created`
(`message` + `recipients`, section 5.1), `ticket.read` (`reader`, section 5.2),
`ticket.visit_changed` (`previousVisit`; the installation visit was moved, see `visit` in section 4).
They are sent for iDesk-filed tickets too (`ticket.origin = "IDESK"`): match those to the iPop
user by `ticket.requester.nik`, and to your record by `ticket.ticketId` (no `externalRef`).

- Delivery is at-least-once: use `id` to ignore duplicates.
- A non-2xx answer or a timeout (10 s) is retried after 1 min, 5 min, 30 min and 2 h, then dropped.
  Use section 4 to resync.
- For one ticket, events are sent in the order they happened.

### 5.1 New chat message: `ticket.message_created`

Sent for every public message, to **the other side** of the conversation:

| Sender | `recipients` |
|---|---|
| ICT (anyone but the requester) | the requester |
| the requester | the **assigned agent** (nothing when the ticket is unassigned) |

Recipients are HRIS NIKs, the only key iPop matches on; people without a NIK are left out,
and the event is not sent when nobody is left. The sender is never a recipient. Never sent
for internal notes or system messages (status changes have their own events).

```json
{
  "id": "9b2d7c44-....",
  "event": "ticket.message_created",
  "occurredAt": "2026-10-11T03:00:01.000Z",
  "message": {
    "id": "5c1e0f7a-....",
    "sender": { "name": "Agent Name" },
    "fromRequester": false,
    "preview": "Sudah saya cek, mohon restart laptop Anda lalu coba lagi",
    "attachmentCount": 1,
    "attachments": [ { "name": "layar.png", "kind": "image" } ],
    "createdAt": "2026-10-11T03:00:00.000Z"
  },
  "recipients": [ { "nik": "00000024" } ],
  "ticket": { "...": "same shape as section 4" }
}
```

- `preview`: plain text (markup removed), at most 100 characters; longer messages end with `…`.
  A message with only attachments has `preview` = `"📎 2 lampiran"`.
- `attachments[].kind`: `image`, `video` or `file`, so iPop can say "📎 Foto" / "📎 Video" /
  "📎 laporan.pdf". The files themselves stay in iDesk.
- If a reply also moved the ticket (e.g. `TODO` -> `IN_PROGRESS`), the `ticket.status_changed`
  event for it is sent **before** `ticket.message_created`.
- Several messages in a row produce one event each. Show **one notification per ticket and
  person**, updated with the latest message and a counter.
- Recipients that are not the requester (the agent) have no iPop copy of the ticket: open
  `ticket.url` through "Sign in with iPop" for them.

### 5.2 Ticket opened in iDesk: `ticket.read`

Sent when someone opens the ticket in iDesk, so iPop can clear that person's chat
notifications for it.

```json
{ "id": "…", "event": "ticket.read", "occurredAt": "…", "reader": { "nik": "00061058" }, "ticket": { "...": "section 4" } }
```

### C# (.NET) webhook receiver

```csharp
app.MapPost("/api/idesk/webhook", async (HttpRequest req, IConfiguration cfg) =>
{
    using var reader = new StreamReader(req.Body, Encoding.UTF8);
    var body = await reader.ReadToEndAsync();
    var ts = req.Headers["x-ipop-timestamp"].ToString();
    var sig = req.Headers["x-ipop-signature"].ToString();

    if (!long.TryParse(ts, out var ms) || Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - ms) > 300_000)
        return Results.Unauthorized();

    using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(cfg["IDesk:ClientSecret"]!));
    var expected = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{ts}.{body}"))).ToLowerInvariant();
    if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(sig)))
        return Results.Unauthorized();

    var evt = JsonSerializer.Deserialize<JsonElement>(body);
    // TODO: skip if evt.id was already processed; find the iPop record by ticket.externalRef
    // (origin IPOP) or by ticket.ticketId + ticket.requester.nik (origin IDESK).
    if (evt.GetProperty("event").GetString() == "ticket.message_created")
    {
        var ticket = evt.GetProperty("ticket");
        var msg = evt.GetProperty("message");
        // TODO: upsert the notification for (requester NIK, ticketId): title from
        // ticket.ticketNumber + ticket.title, body from msg.sender.name + msg.preview,
        // link = ticket.url (opens iDesk), unread counter + 1.
    }
    return Results.Ok();
});
```

## 6. iDesk configuration

| Env var | Value |
|---|---|
| `IPOP_CLIENT_ID` | e.g. `ipop` |
| `IPOP_CLIENT_SECRET` | random, at least 32 chars, shared with iPop only |
| `IPOP_WEBHOOK_URL` | iPop webhook URL; leave empty to disable callbacks |

## 7. Zoom bookings -> iPop calendar

Zoom meetings booked in iDesk are exposed read-only so iPop can put them on its users'
calendars. Each entry carries the Zoom join link; booking, rescheduling and cancelling stay
in iDesk (`url` opens the booking there).

### 7.1 Calendar entry

```json
{
  "bookingId": "0f6c2b1e-6a43-4b8e-9d3f-1b2a3c4d5e6f",
  "seriesId": null,
  "title": "Weekly sync",
  "description": "Agenda Q4",
  "start": "2026-10-12T02:00:00.000Z",
  "end": "2026-10-12T03:30:00.000Z",
  "timezone": "Asia/Jakarta",
  "account": { "name": "Zoom 1" },
  "zoom": {
    "meetingId": "81234567890",
    "joinUrl": "https://zoom.us/j/81234567890?pwd=...",
    "passcode": "abc123"
  },
  "attendees": [
    { "nik": "00000024", "name": "Budi", "role": "BOOKER" },
    { "nik": "00000031", "name": "Sari Dewi", "role": "PARTICIPANT" }
  ],
  "updatedAt": "2026-10-11T01:00:00.000Z",
  "url": "https://idesk.santos.co.id/zoom-booking/0f6c2b1e-6a43-4b8e-9d3f-1b2a3c4d5e6f"
}
```

- `start` / `end` are UTC. iDesk books in WIB; `timezone` is given for display.
- `attendees`: the booker and the invited participants that are iDesk users with a NIK.
  Put the entry on the calendar of **each** NIK. Guests outside the company are not listed.
- Recurring bookings: **one entry per occurrence**, each with its own `bookingId`; the
  occurrences of one series share `seriesId`. A single occurrence can be moved or cancelled.
- Only confirmed bookings with a Zoom link are shared. The host start link, host email and
  recordings are never sent.
- `url` opens the booking in iDesk (login first if needed), in the user's own portal.

Suggested mapping to a calendar event: subject = `title`, start/end = `start`/`end`,
location = `zoom.joinUrl`, body = `description` + meeting ID + passcode + "Kelola di iDesk: {url}".

### 7.2 `GET /zoom-bookings?nik=...&from=YYYY-MM-DD&to=YYYY-MM-DD`

Every booking in that date range (WIB, inclusive, at most 92 days) the user booked or is
invited to, earliest first, max 500. Use it for the initial sync and to resync.

Cancelled bookings are deleted in iDesk, so they are simply **absent** from this list:
when resyncing, replace all iDesk entries of that user in the range with the result.

`GET /zoom-bookings/{bookingId}`: one entry; `404` if it was cancelled or is not shared.

### 7.3 Webhook events

Same webhook URL, headers and retry as section 5, with `booking` instead of `ticket`:

```json
{
  "id": "1d0b5a2c-....",
  "event": "zoom_booking.created",
  "occurredAt": "2026-10-11T01:00:02.000Z",
  "booking": { "...": "same shape as 7.1" }
}
```

| Event | When | `booking` | iPop action |
|---|---|---|---|
| `zoom_booking.created` | booked (or its Zoom link created after a retry) | full entry | add to each attendee's calendar |
| `zoom_booking.updated` | rescheduled; one event per moved occurrence | full entry | update the entry by `bookingId` |
| `zoom_booking.cancelled` | cancelled; one event per occurrence | `{ "bookingId", "seriesId" }` only | delete the entry by `bookingId` |

Match entries by `bookingId`. Attendees are read when the event is sent: compare with the
calendars that already hold the entry when applying `updated`.

### 7.4 C# (.NET) handling (in the receiver of section 5)

```csharp
var booking = evt.GetProperty("booking");
var bookingId = booking.GetProperty("bookingId").GetString()!;
switch (evt.GetProperty("event").GetString())
{
    case "zoom_booking.created":
    case "zoom_booking.updated":
        foreach (var a in booking.GetProperty("attendees").EnumerateArray())
        {
            // TODO: upsert calendar entry (a.nik, bookingId): title, start, end (UTC),
            // location = booking.zoom.joinUrl, link "Kelola di iDesk" = booking.url
        }
        break;
    case "zoom_booking.cancelled":
        // TODO: delete every calendar entry with this bookingId
        break;
}
```
