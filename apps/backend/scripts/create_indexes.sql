-- Full-Text Search GIN Index for iDesk Tickets
-- Run this script directly in PostgreSQL to add the indexes

-- 1. GIN index for full-text search on tickets
-- Using 'indonesian' configuration for Indonesian language support
CREATE INDEX IF NOT EXISTS idx_tickets_search_vector 
ON tickets USING GIN (
    to_tsvector('indonesian', COALESCE(title, '') || ' ' || COALESCE(description, ''))
);

-- 2. Index on assignedToId for agent stats queries
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_id 
ON tickets ("assignedToId");

-- 3. Composite index for SLA checker queries
CREATE INDEX IF NOT EXISTS idx_tickets_sla_check 
ON tickets (status, "isOverdue", "slaTarget", "slaStartedAt")
WHERE status IN ('TODO', 'IN_PROGRESS');

-- 4. Index for first response SLA check
CREATE INDEX IF NOT EXISTS idx_tickets_first_response_check 
ON tickets ("firstResponseAt", "firstResponseTarget", "isFirstResponseBreached")
WHERE "firstResponseAt" IS NULL AND "firstResponseTarget" IS NOT NULL;

-- Verify indexes were created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'tickets' 
AND indexname LIKE 'idx_tickets%';
