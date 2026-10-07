-- One-off correction for HR-2026-0011 (installation marked done while the agreed slot was
-- 9 Oct instead of 10 Oct). Only needed if the request is already COMPLETED; while it is
-- AWAITING_USER_CONFIRMATION the requester can use "Laporkan Masalah" instead.
--
-- Run the SELECTs first and check the output before running the transaction.

-- 1. Inspect
SELECT id, "requestNumber", status, install_marked_done_at, "completedAt"
FROM hardware_requests
WHERE "requestNumber" = 'HR-2026-0011';

SELECT s.id, s.status, s."scheduledStart", s."scheduledEnd", s."ticketId", s."createdAt"
FROM installation_schedules s
JOIN hardware_requests r ON r.id = s."requestId"
WHERE r."requestNumber" = 'HR-2026-0011'
ORDER BY s."createdAt";

-- 2. Correct: back to INSTALLATION, retire the wrong schedule(s), reopen the ticket.
BEGIN;

UPDATE hardware_requests
SET status = 'INSTALLATION',
    install_marked_done_at = NULL,
    user_confirmed_at = NULL,
    user_confirmation_kind = NULL,
    "completedAt" = NULL
WHERE "requestNumber" = 'HR-2026-0011'
  AND status IN ('AWAITING_USER_CONFIRMATION', 'COMPLETED');

UPDATE installation_schedules s
SET status = 'CANCELLED'
FROM hardware_requests r
WHERE r.id = s."requestId"
  AND r."requestNumber" = 'HR-2026-0011'
  AND s.status NOT IN ('CANCELLED', 'RESCHEDULED');

-- The linked ticket stays the same ticket; it is moved to the new slot when the
-- requester picks one from the next proposal.
UPDATE tickets t
SET status = 'IN_PROGRESS', "closedAt" = NULL
FROM installation_schedules s
JOIN hardware_requests r ON r.id = s."requestId"
WHERE t.id = s."ticketId"
  AND r."requestNumber" = 'HR-2026-0011'
  AND t.status IN ('RESOLVED', 'CLOSED');

-- Check, then COMMIT (or ROLLBACK).
SELECT status FROM hardware_requests WHERE "requestNumber" = 'HR-2026-0011';
-- COMMIT;
