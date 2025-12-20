-- Check manager user
SELECT id, email, role, "isActive", "siteId" FROM users WHERE role = 'MANAGER';

-- Check all users and roles
SELECT role, COUNT(*) as count FROM users GROUP BY role;
