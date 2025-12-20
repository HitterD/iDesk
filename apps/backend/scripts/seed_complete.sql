-- ============================================
-- iDesk Complete Seed Script
-- For fresh install or resync
-- ============================================

-- 1. Ensure Sites exist (upsert)
INSERT INTO sites (id, code, name, "isServerHost", "isActive", timezone, "createdAt") VALUES 
(gen_random_uuid(), 'SPJ', 'Sepanjang', true, true, 'Asia/Jakarta', NOW()),
(gen_random_uuid(), 'SMG', 'Semarang', false, true, 'Asia/Jakarta', NOW()),
(gen_random_uuid(), 'KRW', 'Karawang', false, true, 'Asia/Jakarta', NOW()),
(gen_random_uuid(), 'JTB', 'Jakarta', false, true, 'Asia/Jakarta', NOW())
ON CONFLICT (code) DO NOTHING;

-- 2. Ensure Priority Weights exist
INSERT INTO priority_weights (id, priority, points, "updatedAt") VALUES
(gen_random_uuid(), 'LOW', 1, NOW()),
(gen_random_uuid(), 'MEDIUM', 2, NOW()),
(gen_random_uuid(), 'HIGH', 4, NOW()),
(gen_random_uuid(), 'CRITICAL', 8, NOW()),
(gen_random_uuid(), 'HARDWARE_INSTALLATION', 3, NOW())
ON CONFLICT (priority) DO NOTHING;

-- 3. Ensure Access Types exist
INSERT INTO access_types (id, name, description, "validityDays", "requiresSuperiorSignature", "requiresUserSignature") VALUES
(gen_random_uuid(), 'WiFi', 'Office WiFi Access', 365, true, true),
(gen_random_uuid(), 'VPN', 'Remote VPN Access', 90, true, true),
(gen_random_uuid(), 'Website', 'Website Unblock Request', 30, true, false)
ON CONFLICT DO NOTHING;

-- 4. Ensure Default Notification Sounds exist
INSERT INTO notification_sounds (id, "eventType", "soundName", "soundUrl", "isDefault", "isActive", "createdAt") VALUES
(gen_random_uuid(), 'new_ticket', 'New Ticket Alert', '/sounds/default/new-ticket.mp3', true, true, NOW()),
(gen_random_uuid(), 'assigned', 'Ticket Assigned', '/sounds/default/assigned.mp3', true, true, NOW()),
(gen_random_uuid(), 'resolved', 'Ticket Resolved', '/sounds/default/resolved.mp3', true, true, NOW()),
(gen_random_uuid(), 'critical', 'Critical Alert', '/sounds/default/critical-alert.mp3', true, true, NOW()),
(gen_random_uuid(), 'message', 'New Message', '/sounds/default/message.mp3', true, true, NOW())
ON CONFLICT DO NOTHING;

-- 5. Sync orphan data to SPJ (default site)
DO $$
DECLARE
    spj_id UUID;
BEGIN
    SELECT id INTO spj_id FROM sites WHERE code = 'SPJ';
    
    IF spj_id IS NOT NULL THEN
        -- Update tickets without siteId
        UPDATE tickets SET "siteId" = spj_id WHERE "siteId" IS NULL;
        
        -- Update users without siteId
        UPDATE users SET "siteId" = spj_id WHERE "siteId" IS NULL;
        
        -- Update departments without siteId
        UPDATE departments SET "siteId" = spj_id WHERE "siteId" IS NULL;
        
        RAISE NOTICE 'Synced orphan data to SPJ site';
    ELSE
        RAISE NOTICE 'SPJ site not found!';
    END IF;
END $$;

-- 6. Verification
SELECT 'Data Sync Complete!' as status;
SELECT 'Sites:' as info, COUNT(*) as count FROM sites;
SELECT 'Users with Site:' as info, COUNT(*) as count FROM users WHERE "siteId" IS NOT NULL;
SELECT 'Tickets with Site:' as info, COUNT(*) as count FROM tickets WHERE "siteId" IS NOT NULL;
