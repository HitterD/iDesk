# Design Specification: Client Oracle/K2 Ticket Visibility

**Date:** 2026-07-27  
**Status:** Approved  
**Topic:** Show Oracle/K2 requests created by clients in client My Tickets and TV Board while preserving Oracle queue isolation for agents and admins.

---

## 1. Problem

A client can create an Oracle/K2 request with `category` and `ticketType` set to `ORACLE_REQUEST`. The request appears in the Oracle/K2 queue for authorized agents and admins, but does not appear in client My Tickets.

`BentoMyTicketsPage` requests `GET /tickets/paginated`. `TicketQueryService.findAllPaginated` currently excludes Oracle/K2 tickets before role filtering, including for `USER`. The client cannot track their own request.

TV Board already queries all `TODO` and `IN_PROGRESS` tickets for its site and maps Oracle/K2 requests with `isOracleRequest: true`. Ticket creation also emits `tv-board.ticket-changed`. Preserve this behavior and cover it with regression tests.

## 2. Goals

1. A client sees every ticket they created in My Tickets, including Oracle/K2 requests.
2. Oracle/K2 requests stay isolated from the general ticket list for admins, managers, and operational agents.
3. Oracle/K2 queue remains available only through `GET /tickets/paginated/oracle` to `ADMIN` and `AGENT_ORACLE`.
4. TV Board shows Oracle/K2 requests in `TODO` and `IN_PROGRESS` like normal tickets, with existing `ORACLE / K2` classification badge.
5. No client-supplied flag can change Oracle/K2 authorization or visibility.

## 3. Non-goals

- Change Oracle/K2 ticket creation payload or auto-assignment policy.
- Change Oracle/K2 agent assignment authorization.
- Add endpoint, query parameter, frontend merging logic, or TV Board layout.
- Show resolved, cancelled, or waiting-vendor tickets in TV Board columns.

## 4. Design

### 4.1 Paginated ticket query

Update `TicketQueryService.findAllPaginated` role-aware Oracle/K2 filtering.

| Caller role | `GET /tickets/paginated` behavior |
| --- | --- |
| `USER` | Filter to `ticket.userId = :userId`; include normal and Oracle/K2 tickets owned by caller. |
| `AGENT`, `AGENT_OPERATIONAL_SUPPORT`, `AGENT_ADMIN` | Exclude Oracle/K2 tickets. |
| `ADMIN`, `MANAGER` | Exclude Oracle/K2 tickets from general list. |
| `AGENT_ORACLE` | Keep existing dedicated Oracle endpoint behavior; do not use general list as Oracle queue. |

Oracle/K2 detection remains `ticket.ticketType = 'ORACLE_REQUEST' OR ticket.category = 'ORACLE_REQUEST'`. Role filtering runs server-side. Frontend sends no visibility override.

### 4.2 Client My Tickets

`BentoMyTicketsPage` continues calling `GET /tickets/paginated` without Oracle-specific parameters. It keeps server response intact, preserving server-side pagination, meta totals, search, status filtering, sockets, and category labels. Once backend permits the caller's Oracle/K2 records, they render as ordinary ticket rows.

### 4.3 TV Board

No production logic change expected. `TvBoardService.getBoardData` continues loading all site tickets in `TODO` and `IN_PROGRESS`; `toCard` marks Oracle/K2 cards with `isOracleRequest`. Ticket creation continues emitting `tv-board.ticket-changed` for a ticket with `siteId`, allowing subscribed board clients to refresh.

## 5. Error Handling and Security

- Authorization remains backend-enforced by role and owner ID.
- No client-controlled parameter permits reading Oracle/K2 tickets outside existing role/ownership rules.
- Existing site isolation applies to non-cross-site roles.
- Existing TV Board token-to-site lookup limits board output to token's site.
- Existing failed-request UI and TV Board socket reconnect behavior remain unchanged.

## 6. Tests and Verification

1. Extend `ticket-query.service.spec.ts` to assert:
   - `USER` paginated query filters by `userId` and does not append Oracle/K2 exclusion.
   - `ADMIN` and operational-agent queries retain Oracle/K2 exclusion for general lists.
   - Oracle endpoint remains Oracle-only.
2. Retain or strengthen `tv-board.service.spec.ts` coverage that `TODO` and `IN_PROGRESS` Oracle/K2 tickets become board cards with `isOracleRequest: true`.
3. Extend ticket-create service coverage only if missing: Oracle/K2 ticket creation with a site emits `tv-board.ticket-changed` with that site ID.
4. Run target backend tests, backend test suite if feasible, and frontend production build.
5. Manually verify:
   - Client creates Oracle/K2 request and sees it in My Tickets.
   - Oracle agent/admin sees it in Oracle/K2 queue.
   - Admin and operational general ticket lists do not show it.
   - Same site's TV Board shows it while status is `TODO` or `IN_PROGRESS`, including existing Oracle/K2 badge.
