# iDesk API for iPop

iPop (`https://ipop.santos.co.id`) creates iDesk tickets and shows their progress.
Chat, attachments after creation and internal notes stay in iDesk; every ticket carries
a link to open it there. iPop is told when a new chat message arrives (a short preview,
see section 5.1) so it can notify the user, but replying always happens in iDesk.

iPop also sees tickets the user filed **directly in iDesk**. They are linked by the
requester's NIK (shared with iPop through HRIS) and appear with `origin: "IDESK"` and
`externalRef: null`. Requesters without a NIK, and ticket types hidden from the requester's
"My Tickets" in iDesk (ICT budget, automatic hardware-installation tickets), are not shared.

- Base URL: `https://idesk.santos.co.id/api/v1/integrations/ipop`
- Format: JSON (UTF-8) in both directions
- Rate limit: 120 requests per minute

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
  "createdAt": "2026-10-04T01:00:00.000Z",
  "updatedAt": "2026-10-04T02:10:00.000Z",
  "resolvedAt": null,
  "closedAt": null,
  "url": "https://idesk.santos.co.id/client/tickets/bb4ed960-03e1-4428-8f64-136f60340381"
}
```

`status`: `TODO` (open) -> `IN_PROGRESS` -> `WAITING_VENDOR` -> `RESOLVED` (waiting for the
requester to confirm in iDesk) -> `CLOSED` (final). `CANCELLED` is final too.

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
(`message`, section 5.1).
They are sent for iDesk-filed tickets too (`ticket.origin = "IDESK"`): match those to the iPop
user by `ticket.requester.nik`, and to your record by `ticket.ticketId` (no `externalRef`).

- Delivery is at-least-once: use `id` to ignore duplicates.
- A non-2xx answer or a timeout (10 s) is retried after 1 min, 5 min, 30 min and 2 h, then dropped.
  Use section 4 to resync.
- For one ticket, events are sent in the order they happened.

### 5.1 New chat message: `ticket.message_created`

Sent when someone **other than the requester** posts a public message on the ticket (usually
the IT agent, also replies sent by email). Never sent for internal notes, system messages
(status changes have their own events) or the requester's own messages.

```json
{
  "id": "9b2d7c44-....",
  "event": "ticket.message_created",
  "occurredAt": "2026-10-11T03:00:01.000Z",
  "message": {
    "id": "5c1e0f7a-....",
    "sender": { "name": "Agent Name" },
    "preview": "Sudah saya cek, mohon restart laptop Anda lalu coba lagi",
    "attachmentCount": 0,
    "createdAt": "2026-10-11T03:00:00.000Z"
  },
  "ticket": { "...": "same shape as section 4" }
}
```

- `preview`: plain text (markup removed), at most 100 characters; longer messages end with `…`.
  A message with only attachments has `preview` = `"📎 2 lampiran"`. The full message and
  the attachments are only available in iDesk.
- Recipient: the iPop user with NIK `ticket.requester.nik`.
- If a reply also moved the ticket (e.g. `TODO` -> `IN_PROGRESS`), the `ticket.status_changed`
  event for it is sent **before** `ticket.message_created`.
- Several messages in a row produce one event each. Show **one notification per ticket**
  (keyed by `ticket.ticketId`) and update it with the latest `preview` and a counter, instead
  of stacking a notification per message.

**What the user sees in iPop (recommended):**

```
💬 Balasan baru di tiket 041026-INS-0001
Wifi lantai 2 mati
Agent Name: "Sudah saya cek, mohon restart laptop Anda lalu coba lagi"
[ Balas di iDesk ]
```

- `[ Balas di iDesk ]` opens `ticket.url` in a new tab. iPop has no reply box: replying,
  reading the whole conversation and opening attachments all happen in iDesk.
- If the user is not logged in to iDesk, iDesk shows its login page and returns to the
  ticket afterwards.
- Mark the notification as read when it is clicked. iDesk does not report read status back.

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
