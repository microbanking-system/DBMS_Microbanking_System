-- Insert admin user data into the database
-- Run these queries in order

-- 1. First, insert contact information for the admin
INSERT INTO Contact (type, contact_no_1, contact_no_2, address, email)
VALUES ('employee', '+1234567890', NULL, '123 Admin Street, City', 'admin@microbanking.com')
RETURNING contact_id;

-- Note: Remember the contact_id returned from above query

-- 2. Insert a main branch (if not exists)
INSERT INTO Branch (name, contact_id)
VALUES ('Main Branch', 1)  -- Replace 1 with the contact_id from step 1
RETURNING branch_id;

-- Note: Remember the branch_id returned from above query

-- 3. Finally, insert the admin employee
INSERT INTO Employee (role, username, password, first_name, last_name, nic, gender, date_of_birth, branch_id, contact_id)
VALUES (
    'Admin',                                                    -- role
    'admin',                                                   -- username
    '$2a$10$z8XMweokob.ErL0iZxgw4esHMnaJjkT9UDiTEaYbqTc2ktF1dPfJ.',  -- hashed password
    'System',                                                  -- first_name
    'Administrator',                                           -- last_name
    '123456789V',                                             -- nic (sample)
    'Other',                                                  -- gender
    '1990-01-01',                                            -- date_of_birth
    1,                                                       -- branch_id (replace with actual from step 2)
    1                                                        -- contact_id (replace with actual from step 1)
)
RETURNING employee_id;

-- Alternative: If you want to do it all in one transaction with CTEs:
-- WITH new_contact AS (
--     INSERT INTO Contact (type, contact_no_1, address, email)
--     VALUES ('employee', '+1234567890', '123 Admin Street, City', 'admin@microbanking.com')
--     RETURNING contact_id
-- ),
-- new_branch AS (
--     INSERT INTO Branch (name, contact_id)
--     SELECT 'Main Branch', contact_id FROM new_contact
--     RETURNING branch_id, (SELECT contact_id FROM new_contact) as contact_id
-- )
-- INSERT INTO Employee (role, username, password, first_name, last_name, nic, gender, date_of_birth, branch_id, contact_id)
-- SELECT 
--     'Admin',
--     'admin',
--     '$2a$10$bx.rG6dI7s56xOCFb4UUCOv4vdzI/l/iYhPV56OsPE2va/QO9Mnzq',
--     'System',
--     'Administrator', 
--     '123456789V',
--     'Other',
--     '1990-01-01',
--     branch_id,
--     contact_id
-- FROM new_branch
-- RETURNING employee_id, username;