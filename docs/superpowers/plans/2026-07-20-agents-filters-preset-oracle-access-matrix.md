# Oracle / K2 Access & Permissions Matrix Verification

This document documents the final access matrix and test verification results for the Agents Filters, System Presets, and Oracle/K2 Ticket Access Control Implementation.

---

## 1. Role & Access Permission Matrix

| User Role | Navigation Routes Available | Default System Preset ID | Can View Oracle Tickets? | Can Mutate Oracle Tickets? | Can Create Oracle Tickets? | Server Agent Count Scope |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`ADMIN`** | Unrestricted (all routes) | `preset-system-admin` | ✅ Yes | ✅ Yes | ✅ Yes | Total Server Count |
| **`AGENT_ORACLE`** | `/tickets/oracle-k2`, `/notifications` | `preset-system-agent-oracle` | ✅ Yes | ✅ Yes (Oracle only) | ✅ Yes | Server Oracle Count |
| **`AGENT`** | All non-Oracle agent routes | `preset-system-agent` | ❌ No (HTTP 403) | ❌ No (HTTP 403) | ❌ No (HTTP 403) | Server Agent Count |
| **`AGENT_OPERATIONAL_SUPPORT`** | All non-Oracle agent routes | `preset-system-agent-ops` | ❌ No (HTTP 403) | ❌ No (HTTP 403) | ❌ No (HTTP 403) | Server Ops Count |
| **`MANAGER`** | Manager dashboard & department view | `preset-system-manager` | ❌ No (HTTP 403) | ❌ No (HTTP 403) | ❌ No (HTTP 403) | Department Scope |
| **`USER`** | Client self-service portal | `preset-system-user` | ❌ No (HTTP 403) | ❌ No (HTTP 403) | ❌ No (HTTP 403) | N/A |

---

## 2. Default System Presets Summary

| Preset Name | ID | Default Role Association | Zoom Calendar Default | Preset Deletion | Preset Editability |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User** | `preset-system-user` | `USER` | `false` | ❌ Forbidden (HTTP 403) | ✅ Editable (Save button visible) |
| **User Zoom** | `preset-system-user-zoom` | `USER` (alternative) | `true` | ❌ Forbidden (HTTP 403) | ✅ Editable (Save button visible) |
| **Agent** | `preset-system-agent` | `AGENT`, `AGENT_ADMIN` | `true` | ❌ Forbidden (HTTP 403) | ✅ Editable (Save button visible) |
| **Agent Ops Support** | `preset-system-agent-ops` | `AGENT_OPERATIONAL_SUPPORT` | `true` | ❌ Forbidden (HTTP 403) | ✅ Editable (Save button visible) |
| **Agent Oracle** | `preset-system-agent-oracle` | `AGENT_ORACLE` | `true` | ❌ Forbidden (HTTP 403) | ✅ Editable (Save button visible) |
| **Manager** | `preset-system-manager` | `MANAGER` | `true` | ❌ Forbidden (HTTP 403) | ✅ Editable (Save button visible) |
| **Admin** | `preset-system-admin` | `ADMIN` | `true` | ❌ Forbidden (HTTP 403) | ✅ Editable (Save button visible) |

---

## 3. Automated Test Verification Results

### Backend Unit & Integration Tests (Jest)
- **`permissions.service.spec.ts` & `seed-default-presets.spec.ts`**: 13/13 PASS
- **`user-crud.provisioning.spec.ts`**: 2/2 PASS
- **`oracle-ticket-access.util.spec.ts`**: 5/5 PASS
- **`ticket-authorization.spec.ts`**: 3/3 PASS
- **`ticket-create.oracle-guard.spec.ts`**: 2/2 PASS
- **Total Backend Tests**: **25 / 25 PASS (100%)**

### Frontend Integration & Smoke Tests (Vitest)
- **`PresetDrawer.test.tsx`**: 1/1 PASS
- **`oracle-k2-route.test.tsx`**: 1/1 PASS
- **`BentoAdminAgentsPage.smoke.test.tsx`**: 5/5 PASS
- **`BentoOracleK2TicketsPage.smoke.test.tsx`**: 1/1 PASS
- **Total Frontend Tests**: **8 / 8 PASS (100%)**

---

## 4. Verification Checkpoint Status

All 11 tasks specified in the implementation plan `2026-07-20-agents-filters-preset-oracle-access-plan.md` have been executed step-by-step, unit tested, verified, and committed cleanly to Git without build regressions.
