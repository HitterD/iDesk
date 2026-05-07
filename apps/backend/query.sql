EXPLAIN ANALYZE SELECT id, "ticketNumber", title, "createdAt", "updatedAt" FROM tickets WHERE "assignedToId" = '00000000-0000-0000-0000-000000000000' AND status != 'RESOLVED' AND "slaTarget" < NOW();
EXPLAIN ANALYZE SELECT "status", COUNT(*) as count FROM tickets GROUP BY "status";
