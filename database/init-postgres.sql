-- Create database (run this first as postgres user)
-- CREATE DATABASE microbanking;

-- Connect to the database
--\c newdb;

-- Create enum types
CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE contact_type AS ENUM ('customer', 'employee', 'branch');
CREATE TYPE account_status_type AS ENUM ('Active', 'Inactive');
CREATE TYPE plan_type AS ENUM ('Children', 'Teen', 'Adult', 'Senior', 'Joint');
CREATE TYPE auto_renewal_status_type AS ENUM ('True', 'False');
CREATE TYPE fd_status_type AS ENUM ('Active', 'Matured', 'Closed');
CREATE TYPE employee_role AS ENUM ('Manager', 'Agent', 'Admin');
CREATE TYPE fd_options_type AS ENUM ('6 months', '1 year', '3 years');
CREATE TYPE transaction_type AS ENUM ('Deposit', 'Withdrawal', 'Interest', 'Transfer');

-- Contact table (must be created first as it's referenced by other tables)
CREATE TABLE IF NOT EXISTS Contact (
    contact_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    type contact_type NOT NULL,
    contact_no_1 VARCHAR(15),
    contact_no_2 VARCHAR(15),
    address VARCHAR(100),
    email VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Branch table
CREATE TABLE IF NOT EXISTS Branch (
    branch_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(50) NOT NULL,
    contact_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES Contact(contact_id) ON DELETE RESTRICT
);

-- FDPlan table
CREATE TABLE IF NOT EXISTS FDPlan (
    fd_plan_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    fd_options fd_options_type NOT NULL,
    interest DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SavingPlan table
CREATE TABLE IF NOT EXISTS SavingPlan (
    saving_plan_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    plan_type plan_type NOT NULL,
    interest DECIMAL(5,2) NOT NULL,
    min_balance DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FixedDeposit table
CREATE TABLE IF NOT EXISTS FixedDeposit (
    fd_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    fd_balance DECIMAL(15,2) NOT NULL,
    auto_renewal_status auto_renewal_status_type NOT NULL,
    fd_status fd_status_type NOT NULL,
    open_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    fd_plan_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fd_plan_id) REFERENCES FDPlan(fd_plan_id) ON DELETE RESTRICT
);

-- Employee table - UPDATED to match frontend
CREATE TABLE IF NOT EXISTS Employee (
    employee_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    role employee_role NOT NULL,
    username VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    nic VARCHAR(15) NOT NULL,
    gender gender_type NOT NULL,
    date_of_birth DATE NOT NULL,
    branch_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id) ON DELETE RESTRICT,
    FOREIGN KEY (contact_id) REFERENCES Contact(contact_id) ON DELETE RESTRICT
);

-- Customer table
CREATE TABLE IF NOT EXISTS Customer (
    customer_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    gender gender_type NOT NULL,
    nic VARCHAR(15) NOT NULL,
    date_of_birth DATE NOT NULL,
    contact_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES Contact(contact_id) ON DELETE RESTRICT
);

-- Account table
CREATE TABLE IF NOT EXISTS Account (
    account_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    open_date DATE NOT NULL,
    account_status account_status_type NOT NULL,
    balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    saving_plan_id INTEGER,
    fd_id INTEGER,
    branch_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (saving_plan_id) REFERENCES SavingPlan(saving_plan_id) ON DELETE SET NULL,
    FOREIGN KEY (fd_id) REFERENCES FixedDeposit(fd_id) ON DELETE SET NULL,
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id) ON DELETE RESTRICT
);

-- Transaction table
CREATE TABLE IF NOT EXISTS Transaction (
    transaction_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    transaction_type transaction_type NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    time TIMESTAMP NOT NULL,
    description VARCHAR(100),
    account_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES Account(account_id) ON DELETE RESTRICT,
    FOREIGN KEY (employee_id) REFERENCES Employee(employee_id) ON DELETE RESTRICT
);

-- Takes table (junction table for Customer-Account relationship)
CREATE TABLE IF NOT EXISTS Takes (
    takes_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    customer_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES Account(account_id) ON DELETE CASCADE,
    UNIQUE(customer_id, account_id)
);

-- Table to track FD interest calculations
CREATE TABLE IF NOT EXISTS fd_interest_calculations (
    id SERIAL PRIMARY KEY,
    fd_id INTEGER NOT NULL,
    calculation_date DATE NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    days_in_period INTEGER NOT NULL,
    credited_to_account_id INTEGER NOT NULL,
    credited_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fd_id) REFERENCES FixedDeposit(fd_id) ON DELETE CASCADE,
    FOREIGN KEY (credited_to_account_id) REFERENCES Account(account_id) ON DELETE CASCADE
);

-- Table to store interest calculation periods
CREATE TABLE IF NOT EXISTS fd_interest_periods (
    id SERIAL PRIMARY KEY,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    is_processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to track savings interest calculations
CREATE TABLE IF NOT EXISTS savings_interest_calculations (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    calculation_date DATE NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    plan_type VARCHAR(20) NOT NULL,
    credited_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES Account(account_id) ON DELETE CASCADE
);

-- Table to store savings interest calculation periods
CREATE TABLE IF NOT EXISTS savings_interest_periods (
    id SERIAL PRIMARY KEY,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    is_processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaction_audit_log (
    audit_id SERIAL PRIMARY KEY,
    transaction_type transaction_type,
    amount DECIMAL(12,2),
    attempted_time TIMESTAMP,
    description VARCHAR(100),
    account_id INTEGER,
    employee_id INTEGER,
    status VARCHAR(20) NOT NULL, -- 'success', 'failed'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- OPTIMIZATION: Database Functions
-- =============================================================================

-- Function to safely update account balance with validation
CREATE OR REPLACE FUNCTION update_account_balance(
    p_account_id INTEGER,
    p_amount DECIMAL(15,2),
    p_transaction_type transaction_type
) RETURNS DECIMAL(15,2) AS $$
DECLARE
    current_balance DECIMAL(15,2);
    new_balance DECIMAL(15,2);
    min_balance_threshold DECIMAL(15,2);
BEGIN
    -- Get current balance and minimum balance requirement
    SELECT a.balance, sp.min_balance 
    INTO current_balance, min_balance_threshold
    FROM account a
    JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id
    WHERE a.account_id = p_account_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found: %', p_account_id;
    END IF;
    
    -- Calculate new balance
    -- Treat Interest credits as Deposits
    IF p_transaction_type = 'Deposit' OR p_transaction_type = 'Interest' THEN
        new_balance := current_balance + p_amount;
    ELSIF p_transaction_type = 'Withdrawal' THEN
        new_balance := current_balance - p_amount;
        
        -- Check minimum balance requirement
        IF new_balance < min_balance_threshold THEN
            RAISE EXCEPTION 'Insufficient balance. Minimum balance required: %', min_balance_threshold;
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
    END IF;
    
    -- Update account balance
    UPDATE account SET balance = new_balance WHERE account_id = p_account_id;
    
    RETURN new_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to create transaction with automatic validation
CREATE OR REPLACE FUNCTION create_transaction_with_validation(
    p_transaction_type transaction_type,
    p_amount DECIMAL(12,2),
    p_description VARCHAR(100),
    p_account_id INTEGER,
    p_employee_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_new_balance DECIMAL(15,2);
    v_transaction_id INTEGER;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transaction amount must be positive';
    END IF;
    
    -- Update balance and get new balance
    v_new_balance := update_account_balance(p_account_id, p_amount, p_transaction_type);
    
    -- Create transaction record with current timestamp
    INSERT INTO transaction (
        transaction_type, amount, time, description, account_id, employee_id
    ) VALUES (
        p_transaction_type, p_amount, CURRENT_TIMESTAMP, p_description, p_account_id, p_employee_id
    ) RETURNING transaction_id INTO v_transaction_id;
    
    RETURN v_transaction_id;
EXCEPTION
    WHEN others THEN
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate FD interest for a specific period
CREATE OR REPLACE FUNCTION calculate_fd_interest_period(
    p_period_start DATE,
    p_period_end DATE
) RETURNS TABLE(
    fd_id INTEGER,
    principal_amount DECIMAL(15,2),
    interest_rate DECIMAL(5,2),
    interest_amount DECIMAL(15,2),
    days_in_period INTEGER,
    linked_account_id INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fd.fd_id,
        fd.fd_balance as principal_amount,
        fp.interest as interest_rate,
        -- Fixed 30-day monthly cycle for interest calculation
        ROUND((fd.fd_balance * (fp.interest/100) * (30.0/365.0))::NUMERIC, 2) as interest_amount,
        30 as days_in_period,
        a.account_id as linked_account_id
    FROM fixeddeposit fd
    JOIN fdplan fp ON fd.fd_plan_id = fp.fd_plan_id
    JOIN account a ON fd.fd_id = a.fd_id
    WHERE fd.fd_status = 'Active'
      AND fd.open_date <= p_period_end
      AND (fd.maturity_date IS NULL OR fd.maturity_date >= p_period_start);
END;
$$ LANGUAGE plpgsql;

-- Function to process matured FDs
CREATE OR REPLACE FUNCTION process_matured_fixed_deposits() 
RETURNS TABLE(
    processed_count INTEGER,
    total_principal_returned DECIMAL(15,2)
) AS $$
DECLARE
    matured_record RECORD;
    v_processed_count INTEGER := 0;
    v_total_principal DECIMAL(15,2) := 0;
BEGIN
    FOR matured_record IN 
        SELECT 
            fd.fd_id,
            fd.fd_balance as principal_amount,
            fd.auto_renewal_status,
            a.account_id as linked_account_id,
            fp.fd_options
        FROM fixeddeposit fd
        JOIN account a ON fd.fd_id = a.fd_id
        JOIN fdplan fp ON fd.fd_plan_id = fp.fd_plan_id
        WHERE fd.fd_status = 'Active' 
          AND fd.maturity_date <= CURRENT_DATE
    LOOP
        BEGIN
            -- If auto-renewal is True, only roll the dates forward (no principal returned)
            IF matured_record.auto_renewal_status = 'True' THEN
                UPDATE fixeddeposit 
                SET 
                    open_date = CURRENT_DATE,
                    maturity_date = CURRENT_DATE + 
                        CASE matured_record.fd_options
                            WHEN '6 months' THEN INTERVAL '6 months'
                            WHEN '1 year' THEN INTERVAL '1 year'
                            WHEN '3 years' THEN INTERVAL '3 years'
                        END
                WHERE fd_id = matured_record.fd_id;
            ELSE
                -- Return principal to savings account as a proper transaction
                PERFORM create_transaction_with_validation(
                    'Deposit', 
                    matured_record.principal_amount, 
                    'FD Maturity Principal Return', 
                    matured_record.linked_account_id, 
                    1 -- system/admin employee id
                );

                -- Close the FD and unlink from account
                UPDATE fixeddeposit SET fd_status = 'Closed' WHERE fd_id = matured_record.fd_id;
                UPDATE account SET fd_id = NULL WHERE fd_id = matured_record.fd_id;

                v_total_principal := v_total_principal + matured_record.principal_amount;
            END IF;

            v_processed_count := v_processed_count + 1;
            
        EXCEPTION
            WHEN others THEN
                RAISE NOTICE 'Failed to process matured FD %: %', matured_record.fd_id, SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_processed_count, v_total_principal;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate savings interest for a period
CREATE OR REPLACE FUNCTION calculate_savings_interest_period(
    p_period_start DATE,
    p_period_end DATE
) RETURNS TABLE(
    account_id INTEGER,
    balance DECIMAL(15,2),
    interest_rate DECIMAL(5,2),
    interest_amount DECIMAL(15,2),
    plan_type VARCHAR(20),
    min_balance DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.account_id,
        a.balance,
        sp.interest as interest_rate,
        -- Fixed 30-day monthly cycle for interest calculation
        ROUND((a.balance * (sp.interest/100) * (30.0/365.0))::NUMERIC, 2) as interest_amount,
        sp.plan_type::VARCHAR,
        sp.min_balance
    FROM account a
    JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id
    WHERE a.account_status = 'Active'
      AND a.balance >= sp.min_balance;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- OPTIMIZATION: Triggers
-- =============================================================================

-- Trigger to automatically handle account status changes
CREATE OR REPLACE FUNCTION check_account_status() RETURNS TRIGGER AS $$
BEGIN
    -- Prevent negative balances
    IF NEW.balance < 0 THEN
        RAISE EXCEPTION 'Account balance cannot be negative';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_account_status
    BEFORE UPDATE ON account
    FOR EACH ROW
    EXECUTE FUNCTION check_account_status();

-- Fixed audit transaction trigger
DROP TRIGGER IF EXISTS trigger_audit_transaction ON transaction;

CREATE OR REPLACE FUNCTION audit_transaction() RETURNS TRIGGER AS $$
BEGIN
    -- Log the attempt (will be committed even if transaction fails)
    INSERT INTO transaction_audit_log (
        transaction_type, amount, attempted_time, description, 
        account_id, employee_id, status
    ) VALUES (
        NEW.transaction_type, NEW.amount, NEW.time, NEW.description,
        NEW.account_id, NEW.employee_id, 'attempted'
    );

    -- Validate transaction data
    IF NEW.amount <= 0 THEN
        -- Update log with failure
        UPDATE transaction_audit_log 
        SET status = 'failed', error_message = 'Transaction amount must be positive'
        WHERE audit_id = currval('transaction_audit_log_audit_id_seq');
        RAISE EXCEPTION 'Transaction amount must be positive';
    END IF;
    
    -- Allow reasonable time differences (up to 5 minutes) for clock sync
    IF NEW.time > (CURRENT_TIMESTAMP + INTERVAL '5 minutes') THEN
        UPDATE transaction_audit_log 
        SET status = 'failed', error_message = 'Transaction time cannot be more than 5 minutes in the future'
        WHERE audit_id = currval('transaction_audit_log_audit_id_seq');
        RAISE EXCEPTION 'Transaction time cannot be more than 5 minutes in the future';
    END IF;
    
    -- Prevent backdated transactions beyond 1 day
    IF NEW.time < (CURRENT_TIMESTAMP - INTERVAL '1 day') THEN
        UPDATE transaction_audit_log 
        SET status = 'failed', error_message = 'Transaction time cannot be more than 1 day in the past'
        WHERE audit_id = currval('transaction_audit_log_audit_id_seq');
        RAISE EXCEPTION 'Transaction time cannot be more than 1 day in the past';
    END IF;
    
    -- Update log with success
    UPDATE transaction_audit_log 
    SET status = 'success'
    WHERE audit_id = currval('transaction_audit_log_audit_id_seq');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_transaction
    BEFORE INSERT ON transaction
    FOR EACH ROW
    EXECUTE FUNCTION audit_transaction();

-- Fixed create_transaction_with_validation function
CREATE OR REPLACE FUNCTION create_transaction_with_validation(
    p_transaction_type transaction_type,
    p_amount DECIMAL(12,2),
    p_description VARCHAR(100),
    p_account_id INTEGER,
    p_employee_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_new_balance DECIMAL(15,2);
    v_transaction_id INTEGER;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transaction amount must be positive';
    END IF;
    
    -- Update balance and get new balance
    v_new_balance := update_account_balance(p_account_id, p_amount, p_transaction_type);
    
    -- Create transaction record with current timestamp
    INSERT INTO transaction (
        transaction_type, amount, time, description, account_id, employee_id
    ) VALUES (
        p_transaction_type, p_amount, CURRENT_TIMESTAMP, p_description, p_account_id, p_employee_id
    ) RETURNING transaction_id INTO v_transaction_id;
    
    RETURN v_transaction_id;
EXCEPTION
    WHEN others THEN
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- OPTIMIZATION: Materialized Views for Reporting
-- =============================================================================

-- Materialized view for daily account summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_account_summary AS
SELECT 
    a.account_id,
    a.balance,
    a.account_status,
    sp.plan_type,
    COUNT(t.transaction_id) as transaction_count,
    SUM(CASE WHEN t.transaction_type = 'Deposit' THEN t.amount ELSE 0 END) as total_deposits,
    SUM(CASE WHEN t.transaction_type = 'Withdrawal' THEN t.amount ELSE 0 END) as total_withdrawals,
    MAX(t.time) as last_transaction_date
FROM account a
JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id
LEFT JOIN transaction t ON a.account_id = t.account_id 
    AND t.time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY a.account_id, a.balance, a.account_status, sp.plan_type;

-- Materialized view for FD performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fd_performance AS
SELECT 
    fp.fd_options,
    COUNT(fd.fd_id) as active_count,
    SUM(fd.fd_balance) as total_principal,
    AVG(fp.interest) as avg_interest_rate,
    COUNT(fic.id) as interest_payments_count,
    COALESCE(SUM(fic.interest_amount), 0) as total_interest_paid
FROM fdplan fp
LEFT JOIN fixeddeposit fd ON fp.fd_plan_id = fd.fd_plan_id AND fd.fd_status = 'Active'
LEFT JOIN fd_interest_calculations fic ON fd.fd_id = fic.fd_id AND fic.status = 'credited'
GROUP BY fp.fd_options, fp.fd_plan_id;

-- =============================================================================
-- OPTIMIZATION: Indexes
-- =============================================================================

-- Existing indexes
CREATE INDEX IF NOT EXISTS idx_employee_username ON Employee(username);
CREATE INDEX IF NOT EXISTS idx_employee_role ON Employee(role);
CREATE INDEX IF NOT EXISTS idx_customer_nic ON Customer(nic);
CREATE INDEX IF NOT EXISTS idx_account_status ON Account(account_status);
CREATE INDEX IF NOT EXISTS idx_account_branch ON Account(branch_id);
CREATE INDEX IF NOT EXISTS idx_transaction_account ON Transaction(account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_time ON Transaction(time);
CREATE INDEX IF NOT EXISTS idx_transaction_employee ON Transaction(employee_id);
CREATE INDEX IF NOT EXISTS idx_takes_customer ON Takes(customer_id);
CREATE INDEX IF NOT EXISTS idx_takes_account ON Takes(account_id);
CREATE INDEX IF NOT EXISTS idx_fixed_deposit_status ON FixedDeposit(fd_status);
CREATE INDEX IF NOT EXISTS idx_contact_type ON Contact(type);
CREATE INDEX IF NOT EXISTS idx_savings_interest_account_id ON savings_interest_calculations(account_id);
CREATE INDEX IF NOT EXISTS idx_savings_interest_status ON savings_interest_calculations(status);
CREATE INDEX IF NOT EXISTS idx_savings_interest_calculation_date ON savings_interest_calculations(calculation_date);
CREATE INDEX IF NOT EXISTS idx_savings_interest_periods_processed ON savings_interest_periods(is_processed);
CREATE INDEX IF NOT EXISTS idx_fd_interest_fd_id ON fd_interest_calculations(fd_id);
CREATE INDEX IF NOT EXISTS idx_fd_interest_status ON fd_interest_calculations(status);
CREATE INDEX IF NOT EXISTS idx_fd_interest_calculation_date ON fd_interest_calculations(calculation_date);
CREATE INDEX IF NOT EXISTS idx_fd_interest_periods_processed ON fd_interest_periods(is_processed);

-- New optimized indexes
CREATE INDEX IF NOT EXISTS idx_transaction_account_time 
ON transaction(account_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_account_branch_status 
ON account(branch_id, account_status) 
WHERE account_status = 'Active';

CREATE INDEX IF NOT EXISTS idx_fixed_deposit_status_maturity 
ON fixeddeposit(fd_status, maturity_date) 
WHERE fd_status = 'Active';

CREATE INDEX IF NOT EXISTS idx_customer_account_relationship 
ON takes(customer_id, account_id);

CREATE INDEX IF NOT EXISTS idx_employee_branch_role 
ON employee(branch_id, role);

CREATE INDEX IF NOT EXISTS idx_active_accounts 
ON account(account_id) 
WHERE account_status = 'Active';

CREATE INDEX IF NOT EXISTS idx_recent_transactions 
ON transaction(time DESC) 
WHERE time > CURRENT_DATE - INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_interest_calculations_date 
ON fd_interest_calculations(calculation_date, status);

CREATE INDEX IF NOT EXISTS idx_savings_interest_account_date 
ON savings_interest_calculations(account_id, calculation_date, status);

-- Materialized view indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_account_summary ON mv_daily_account_summary(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fd_performance ON mv_fd_performance(fd_options);

-- Constraints
ALTER TABLE account ADD CONSTRAINT unique_fd_per_account UNIQUE (fd_id);
CREATE INDEX IF NOT EXISTS idx_account_fd_id ON Account(fd_id);
-- Prevent duplicate interest processing for the same period
ALTER TABLE fd_interest_periods ADD CONSTRAINT unique_fd_interest_period UNIQUE (period_start, period_end);
ALTER TABLE savings_interest_periods ADD CONSTRAINT unique_savings_interest_period UNIQUE (period_start, period_end);

-- =============================================================================
-- Refresh materialized views function
-- =============================================================================

CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_account_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fd_performance;
END;
$$ LANGUAGE plpgsql;