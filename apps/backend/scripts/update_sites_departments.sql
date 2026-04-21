-- Update Site Names
-- SPJ - Sepanjang (sebelumnya nama lain)
-- SMG - Semarang
-- KRW - Karawang
-- JTB - Jatibaru (sebelumnya Jatibening)

UPDATE sites SET name = 'Sepanjang' WHERE code = 'SPJ';
UPDATE sites SET name = 'Semarang' WHERE code = 'SMG';
UPDATE sites SET name = 'Karawang' WHERE code = 'KRW';
UPDATE sites SET name = 'Jatibaru' WHERE code = 'JTB';

-- Delete all existing departments
DELETE FROM departments;

-- Insert new departments
INSERT INTO departments (id, code, name, "createdAt", "updatedAt") VALUES
(gen_random_uuid(), 'BOD', 'BOD, Director, & Secretary', NOW(), NOW()),
(gen_random_uuid(), 'ICT', 'ICT', NOW(), NOW()),
(gen_random_uuid(), 'DAFT', 'DAFT', NOW(), NOW()),
(gen_random_uuid(), 'HC', 'Human Capital', NOW(), NOW()),
(gen_random_uuid(), 'MKT', 'MARKETING', NOW(), NOW()),
(gen_random_uuid(), 'OPS', 'OPERATIONAL', NOW(), NOW()),
(gen_random_uuid(), 'PROC', 'PROCUREMENT', NOW(), NOW()),
(gen_random_uuid(), 'RND', 'Research and Development', NOW(), NOW()),
(gen_random_uuid(), 'SOE', 'Strategy & Operational Excellence', NOW(), NOW());

-- Note: This will remove department assignments from users
-- If you want to preserve user-department relationships, update users first
-- UPDATE users SET "departmentId" = NULL WHERE "departmentId" IS NOT NULL;
