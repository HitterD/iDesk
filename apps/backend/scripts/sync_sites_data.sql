-- ============================================
-- iDesk Data Sync Script
-- Sync all data to default site (SPJ)
-- ============================================

-- Get SPJ site ID into variable approach won't work in plain psql
-- So we'll use a subquery

-- 1. Update all tickets without siteId to SPJ
UPDATE tickets 
SET "siteId" = (SELECT id FROM sites WHERE code = 'SPJ')
WHERE "siteId" IS NULL;

-- 2. Update all users without siteId to SPJ  
UPDATE users
SET "siteId" = (SELECT id FROM sites WHERE code = 'SPJ')
WHERE "siteId" IS NULL;

-- 3. Update all departments without siteId to SPJ
UPDATE departments
SET "siteId" = (SELECT id FROM sites WHERE code = 'SPJ')
WHERE "siteId" IS NULL;

-- 4. Verify the sync
SELECT 'After Sync:' as status;
SELECT 'tickets' as table_name, COUNT(*) as total, COUNT("siteId") as with_site FROM tickets
UNION ALL
SELECT 'users' as table_name, COUNT(*) as total, COUNT("siteId") as with_site FROM users
UNION ALL
SELECT 'departments' as table_name, COUNT(*) as total, COUNT("siteId") as with_site FROM departments;

-- 5. Show distribution by site
SELECT 'Tickets by Site:' as status;
SELECT s.code, s.name, COUNT(t.id) as ticket_count
FROM sites s
LEFT JOIN tickets t ON t."siteId" = s.id
GROUP BY s.id, s.code, s.name
ORDER BY s.code;

SELECT 'Users by Site:' as status;
SELECT s.code, s.name, COUNT(u.id) as user_count
FROM sites s
LEFT JOIN users u ON u."siteId" = s.id
GROUP BY s.id, s.code, s.name
ORDER BY s.code;
