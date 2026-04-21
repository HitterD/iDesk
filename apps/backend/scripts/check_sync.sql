-- Check data sync status
SELECT 'tickets' as table_name, COUNT(*) as total, COUNT("siteId") as with_site FROM tickets
UNION ALL
SELECT 'users' as table_name, COUNT(*) as total, COUNT("siteId") as with_site FROM users;

-- Get SPJ site ID
SELECT id, code FROM sites WHERE code = 'SPJ';
