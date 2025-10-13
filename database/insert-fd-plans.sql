-- Insert Fixed Deposit plans into FDPlan table
-- Based on the FD plan data provided

INSERT INTO FDPlan (fd_options, interest) VALUES
('6 months', 13.00),
('1 year', 14.00),
('3 years', 15.00);

-- Verify the inserted data
SELECT * FROM FDPlan ORDER BY fd_plan_id;