-- Create database (run this first as postgres user)
-- CREATE DATABASE microbanking;

-- Connect to the database
\c newdb;

-- Create enum types
CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE contact_type AS ENUM ('customer', 'employee', 'branch');
CREATE TYPE account_status_type AS ENUM ('Active', 'Closed');
CREATE TYPE plan_type AS ENUM ('Children', 'Teen', 'Adult', 'Senior', 'Joint');
CREATE TYPE auto_renewal_status_type AS ENUM ('True', 'False');
CREATE TYPE fd_status_type AS ENUM ('Active', 'Matured', 'Closed');
CREATE TYPE employee_role AS ENUM ('Manager', 'Agent', 'Admin');
CREATE TYPE fd_options_type AS ENUM ('6 months', '1 year', '3 years');
CREATE TYPE transaction_type AS ENUM ('Deposit', 'Withdrawal', 'Interest');

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

-- Enforce minimum age (18+) for employees at the database level
-- Using a trigger so existing data will not block applying this script
CREATE OR REPLACE FUNCTION enforce_employee_min_age()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date_of_birth IS NULL THEN
        RAISE EXCEPTION 'Employee date_of_birth is required';
    END IF;
    -- Ensure employee is at least 18 years old
    IF age(current_date, NEW.date_of_birth) < interval '18 years' THEN
        RAISE EXCEPTION 'Employee must be at least 18 years old';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE event_object_table = 'employee' AND trigger_name = 'trg_employee_min_age'
    ) THEN
        DROP TRIGGER trg_employee_min_age ON employee;
    END IF;
END $$;

CREATE TRIGGER trg_employee_min_age
BEFORE INSERT OR UPDATE OF date_of_birth ON employee
FOR EACH ROW
EXECUTE FUNCTION enforce_employee_min_age();

-- Customer table
CREATE TABLE IF NOT EXISTS Customer (
    customer_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    gender gender_type NOT NULL,
    nic VARCHAR(30) NOT NULL,
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
    closed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (saving_plan_id) REFERENCES SavingPlan(saving_plan_id) ON DELETE SET NULL,
    FOREIGN KEY (fd_id) REFERENCES FixedDeposit(fd_id) ON DELETE SET NULL,
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id) ON DELETE RESTRICT
);

-- Ensure columns exist for previously initialized databases
-- Keep closed_at as metadata for when accounts are closed
ALTER TABLE account ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;

-- Backward compatibility: widen NIC fields if older schema exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customer' AND column_name = 'nic' AND character_maximum_length = 15
    ) THEN
        EXECUTE 'ALTER TABLE customer ALTER COLUMN nic TYPE VARCHAR(30)';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employee' AND column_name = 'nic' AND character_maximum_length = 15
    ) THEN
        EXECUTE 'ALTER TABLE employee ALTER COLUMN nic TYPE VARCHAR(30)';
    END IF;
END $$;

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

-- Legacy cleanup: remove old monthly period tracking tables if they exist
DROP TABLE IF EXISTS fd_interest_periods CASCADE;
DROP TABLE IF EXISTS savings_interest_periods CASCADE;

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

-- Audit table for plan changes
CREATE TABLE IF NOT EXISTS account_plan_change_audit (
    audit_id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    old_saving_plan_id INTEGER NOT NULL,
    new_saving_plan_id INTEGER NOT NULL,
    reason TEXT,
    changed_by_employee_id INTEGER,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES Account(account_id) ON DELETE CASCADE,
    FOREIGN KEY (old_saving_plan_id) REFERENCES SavingPlan(saving_plan_id) ON DELETE RESTRICT,
    FOREIGN KEY (new_saving_plan_id) REFERENCES SavingPlan(saving_plan_id) ON DELETE RESTRICT,
    FOREIGN KEY (changed_by_employee_id) REFERENCES Employee(employee_id) ON DELETE SET NULL
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
    -- Allow guarded direct balance update for this specific account within this transaction
    PERFORM set_config('app.balance_update_allowed', 'true', true);
    PERFORM set_config('app.balance_update_account_id', p_account_id::text, true);

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
    v_transaction_id INTEGER;
BEGIN
    -- Note: Validation and balance updates are handled by BEFORE INSERT trigger on transaction
    -- Create transaction record with current timestamp (trigger may override NEW.time)
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
            AND (fd.maturity_date IS NULL OR fd.maturity_date >= p_period_start)
        AND a.account_status = 'Active';
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

-- Function to calculate FD interest due on a per-account 30-day cycle (anchored to open_date or last credited date)
CREATE OR REPLACE FUNCTION calculate_fd_interest_due(
    p_as_of_date DATE DEFAULT CURRENT_DATE
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
        fd.fd_balance AS principal_amount,
        fp.interest AS interest_rate,
        -- Fixed 30-day cycle for interest calculation
        ROUND((fd.fd_balance * (fp.interest/100) * (30.0/365.0))::NUMERIC, 2) AS interest_amount,
        30 AS days_in_period,
        a.account_id AS linked_account_id
    FROM fixeddeposit fd
    JOIN fdplan fp ON fd.fd_plan_id = fp.fd_plan_id
    JOIN account a ON fd.fd_id = a.fd_id
    LEFT JOIN LATERAL (
        SELECT MAX(fic.calculation_date) AS last_credited_date
        FROM fd_interest_calculations fic
        WHERE fic.fd_id = fd.fd_id AND fic.status = 'credited'
    ) last_fd ON TRUE
    WHERE fd.fd_status = 'Active'
      AND a.account_status = 'Active'
      -- Due if 30 days have elapsed since the last credited date (or open_date if none)
      AND p_as_of_date >= COALESCE(last_fd.last_credited_date, fd.open_date) + INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Savings interest due on a per-account 30-day cycle (anchored to account.open_date or last credited date)
CREATE OR REPLACE FUNCTION calculate_savings_interest_due(
    p_as_of_date DATE DEFAULT CURRENT_DATE
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
        sp.interest AS interest_rate,
        -- Fixed 30-day cycle for interest calculation
        ROUND((a.balance * (sp.interest/100) * (30.0/365.0))::NUMERIC, 2) AS interest_amount,
        sp.plan_type::VARCHAR,
        sp.min_balance
    FROM account a
    JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id
    LEFT JOIN LATERAL (
        SELECT MAX(sic.calculation_date) AS last_credited_date
        FROM savings_interest_calculations sic
        WHERE sic.account_id = a.account_id AND sic.status = 'credited'
    ) last_s ON TRUE
    WHERE a.account_status = 'Active'
      AND a.fd_id IS NULL
      -- Must meet minimum balance at time of processing
      AND a.balance >= sp.min_balance
      -- Due if 30 days have elapsed since the last credited date (or account.open_date if none)
      AND p_as_of_date >= COALESCE(last_s.last_credited_date, a.open_date) + INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- OPTIMIZATION: Triggers
-- =============================================================================

-- Guard: Block direct balance updates unless allowed via session flags
CREATE OR REPLACE FUNCTION guard_direct_account_balance_update() RETURNS TRIGGER AS $$
DECLARE
    v_allowed TEXT;
    v_account_id TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.balance IS DISTINCT FROM OLD.balance THEN
        v_allowed := current_setting('app.balance_update_allowed', true);
        v_account_id := current_setting('app.balance_update_account_id', true);
        IF NOT (v_allowed = 'true' AND v_account_id = NEW.account_id::text) THEN
            RAISE EXCEPTION 'Direct balance update is not allowed. Use the transaction function.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_account_balance_guard ON account;
CREATE TRIGGER trigger_account_balance_guard
    BEFORE UPDATE ON account
    FOR EACH ROW
    EXECUTE FUNCTION guard_direct_account_balance_update();

-- Trigger to automatically validate balance and set account status
CREATE OR REPLACE FUNCTION check_account_status() RETURNS TRIGGER AS $$
BEGIN
    -- Prevent negative balances
    IF NEW.balance < 0 THEN
        RAISE EXCEPTION 'Account balance cannot be negative';
    END IF;

    -- Disallow changing saving plan after creation except through approved session flag for this account
    IF TG_OP = 'UPDATE' AND NEW.saving_plan_id IS DISTINCT FROM OLD.saving_plan_id THEN
        -- Allow only when explicitly permitted for this account in this transaction
        IF NOT (
            current_setting('app.plan_change_allowed', true) = 'true' AND 
            current_setting('app.plan_change_account_id', true) = NEW.account_id::text
        ) THEN
            RAISE EXCEPTION 'Changing account plan is not allowed';
        END IF;
    END IF;

    -- No auto-flip based on min balance; lifecycle is Active or Closed only
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_account_status ON account;
CREATE TRIGGER trigger_account_status
    BEFORE INSERT OR UPDATE OF balance, saving_plan_id ON account
    FOR EACH ROW
    EXECUTE FUNCTION check_account_status();

-- Function: change account saving plan with validations and audit
CREATE OR REPLACE FUNCTION change_account_saving_plan(
    p_account_id INTEGER,
    p_new_saving_plan_id INTEGER,
    p_actor_employee_id INTEGER,
    p_reason TEXT,
    p_new_nic TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_old_plan_id INTEGER;
    v_old_plan_type plan_type;
    v_new_plan_type plan_type;
    v_account_status account_status_type;
    v_balance DECIMAL(15,2);
    v_min_balance_new DECIMAL(10,2);
    v_customer_id INTEGER;
    v_dob DATE;
    v_age_years INTEGER;
BEGIN
    -- Lock the account row
    SELECT a.saving_plan_id, a.account_status, a.balance
    INTO v_old_plan_id, v_account_status, v_balance
    FROM account a
    WHERE a.account_id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found: %', p_account_id;
    END IF;

    IF v_account_status <> 'Active' THEN
        RAISE EXCEPTION 'Plan change only allowed for Active accounts';
    END IF;

    IF v_old_plan_id IS NULL THEN
        RAISE EXCEPTION 'Account has no saving plan assigned';
    END IF;

    -- Fetch plan types and new min balance
    SELECT sp.plan_type INTO v_old_plan_type FROM savingplan sp WHERE sp.saving_plan_id = v_old_plan_id;
    SELECT sp.plan_type, sp.min_balance INTO v_new_plan_type, v_min_balance_new FROM savingplan sp WHERE sp.saving_plan_id = p_new_saving_plan_id;

    IF v_new_plan_type IS NULL THEN
        RAISE EXCEPTION 'Invalid new saving plan id: %', p_new_saving_plan_id;
    END IF;

    -- Disallow Joint involvement entirely
    IF v_old_plan_type = 'Joint' OR v_new_plan_type = 'Joint' THEN
        RAISE EXCEPTION 'Plan changes to/from Joint are not allowed';
    END IF;

    -- No-op if same plan
    IF v_old_plan_id = p_new_saving_plan_id THEN
        RAISE EXCEPTION 'Account is already on the requested plan';
    END IF;

    -- Fetch owner and age (assumes single owner: first Takes row)
    SELECT t.customer_id INTO v_customer_id FROM takes t WHERE t.account_id = p_account_id LIMIT 1;
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Account has no owner linked';
    END IF;

    SELECT c.date_of_birth INTO v_dob FROM customer c WHERE c.customer_id = v_customer_id;
    IF v_dob IS NULL THEN
        RAISE EXCEPTION 'Owner date of birth missing';
    END IF;

    v_age_years := DATE_PART('year', age(CURRENT_DATE, v_dob))::INTEGER;

    -- Optional NIC update (for cases where birth certificate number needs to be replaced/updated)
    IF p_new_nic IS NOT NULL AND btrim(p_new_nic) <> '' THEN
        IF length(p_new_nic) > 30 THEN
            RAISE EXCEPTION 'NIC length must be 30 characters or fewer';
        END IF;
        -- Update owner's NIC. Customer audit trigger will capture this change with actor context set by API.
        UPDATE customer SET nic = btrim(p_new_nic) WHERE customer_id = v_customer_id;
    END IF;

    -- Enforce upgrade-only path by age thresholds
    -- Allowed: Children -> Teen (>=12), Teen -> Adult (>=18), Adult -> Senior (>=60)
    -- Also allow jumping directly if age meets target threshold (e.g., Teen -> Senior at 60+)
    IF v_new_plan_type = 'Children' THEN
        RAISE EXCEPTION 'Downgrades are not allowed';
    ELSIF v_new_plan_type = 'Teen' THEN
        -- Only allow from Children when age >= 12
        IF v_old_plan_type <> 'Children' OR v_age_years < 12 THEN
            RAISE EXCEPTION 'Teen plan change requires current plan Children and age >= 12';
        END IF;
    ELSIF v_new_plan_type = 'Adult' THEN
        IF v_age_years < 18 THEN
            RAISE EXCEPTION 'Adult plan requires age >= 18';
        END IF;
        -- Disallow from Senior -> Adult (downgrade)
        IF v_old_plan_type = 'Senior' THEN
            RAISE EXCEPTION 'Downgrades are not allowed';
        END IF;
    ELSIF v_new_plan_type = 'Senior' THEN
        IF v_age_years < 60 THEN
            RAISE EXCEPTION 'Senior plan requires age >= 60';
        END IF;
    END IF;

    -- Min balance check
    IF v_balance < v_min_balance_new THEN
        RAISE EXCEPTION 'Current balance % is below the new plan''s minimum balance %', v_balance, v_min_balance_new;
    END IF;

    -- Perform guarded update
    PERFORM set_config('app.plan_change_allowed', 'true', true);
    PERFORM set_config('app.plan_change_account_id', p_account_id::text, true);

    UPDATE account SET saving_plan_id = p_new_saving_plan_id WHERE account_id = p_account_id;

    -- Write audit
    INSERT INTO account_plan_change_audit(
        account_id, old_saving_plan_id, new_saving_plan_id, reason, changed_by_employee_id
    ) VALUES (
        p_account_id, v_old_plan_id, p_new_saving_plan_id, p_reason, p_actor_employee_id
    );

    -- Clear flags (optional; end-of-tx scope will clear anyway)
    PERFORM set_config('app.plan_change_allowed', 'false', true);
    PERFORM set_config('app.plan_change_account_id', '', true);

END;
$$ LANGUAGE plpgsql;

-- Auto-calc FD maturity_date based on plan and open_date
CREATE OR REPLACE FUNCTION fd_autocalc_maturity_date() RETURNS TRIGGER AS $$
DECLARE
    v_option fd_options_type;
BEGIN
    -- Only auto-calc for Active FDs
    IF NEW.fd_status = 'Active' THEN
        SELECT fp.fd_options INTO v_option FROM fdplan fp WHERE fp.fd_plan_id = NEW.fd_plan_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid FD plan id: %', NEW.fd_plan_id;
        END IF;
        NEW.maturity_date := NEW.open_date +
            CASE v_option
                WHEN '6 months' THEN INTERVAL '6 months'
                WHEN '1 year' THEN INTERVAL '1 year'
                WHEN '3 years' THEN INTERVAL '3 years'
            END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fd_autocalc_maturity ON fixeddeposit;
CREATE TRIGGER trigger_fd_autocalc_maturity
    BEFORE INSERT OR UPDATE OF open_date, fd_plan_id, fd_status ON fixeddeposit
    FOR EACH ROW
    EXECUTE FUNCTION fd_autocalc_maturity_date();

-- Transaction triggers: validate/apply and audit
-- Drop any legacy audit trigger from previous versions
DROP TRIGGER IF EXISTS trigger_audit_transaction ON transaction;
DROP TRIGGER IF EXISTS trigger_before_transaction_validate_apply ON transaction;
DROP TRIGGER IF EXISTS trigger_after_transaction_audit ON transaction;

-- BEFORE INSERT: validate inputs and apply balance update atomically
CREATE OR REPLACE FUNCTION transaction_validate_and_apply() RETURNS TRIGGER AS $$
DECLARE
    v_allowed BOOLEAN := FALSE;
    v_current_balance DECIMAL(15,2);
    v_account_status account_status_type;
BEGIN
    -- Normalize timestamp if not provided
    IF NEW.time IS NULL THEN
        NEW.time := CURRENT_TIMESTAMP;
    END IF;

    -- Validate amount
    IF NEW.amount <= 0 THEN
        RAISE EXCEPTION 'Transaction amount must be positive';
    END IF;

    -- Validate time window (within +/- 5 minutes, and not older than 1 day)
    IF NEW.time > (CURRENT_TIMESTAMP + INTERVAL '5 minutes') THEN
        RAISE EXCEPTION 'Transaction time cannot be more than 5 minutes in the future';
    END IF;
    IF NEW.time < (CURRENT_TIMESTAMP - INTERVAL '1 day') THEN
        RAISE EXCEPTION 'Transaction time cannot be more than 1 day in the past';
    END IF;

    -- Validate supported transaction types for single-account operations
    IF NEW.transaction_type IN ('Deposit', 'Withdrawal', 'Interest') THEN
        v_allowed := TRUE;
    END IF;
    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Unsupported transaction type for single-account entry: %', NEW.transaction_type;
    END IF;

    -- Fetch current balance and status for special-case handling
    SELECT balance, account_status INTO v_current_balance, v_account_status
    FROM account WHERE account_id = NEW.account_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found: %', NEW.account_id;
    END IF;

    -- Block all transactions on Closed accounts
    IF v_account_status = 'Closed' THEN
        RAISE EXCEPTION 'Account is closed';
    END IF;

    -- Special case: Account Closure flow sets balance to zero first and then inserts a withdrawal for audit
    -- Detect via description and skip balance application to avoid double-subtraction
    IF NEW.transaction_type = 'Withdrawal' AND (
        NEW.description ILIKE 'Account Closure%' OR NEW.description ILIKE '%Account Closure%'
    ) THEN
        -- Skip applying balance update; assume balance was set appropriately prior to this insert
        RETURN NEW;
    END IF;

    -- Apply the balance update and validations (min balance, etc.)
    PERFORM update_account_balance(NEW.account_id, NEW.amount, NEW.transaction_type);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_before_transaction_validate_apply
    BEFORE INSERT ON transaction
    FOR EACH ROW
    EXECUTE FUNCTION transaction_validate_and_apply();

-- AFTER INSERT: write audit log for successful transactions
CREATE OR REPLACE FUNCTION audit_transaction_success() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO transaction_audit_log (
        transaction_type, amount, attempted_time, description, 
        account_id, employee_id, status
    ) VALUES (
        NEW.transaction_type, NEW.amount, NEW.time, NEW.description,
        NEW.account_id, NEW.employee_id, 'success'
    );

    RETURN NULL; -- AFTER trigger, return value ignored
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_after_transaction_audit
    AFTER INSERT ON transaction
    FOR EACH ROW
    EXECUTE FUNCTION audit_transaction_success();

-- (Removed duplicate create_transaction_with_validation definition; kept single simplified definition above)

-- =============================================================================
-- AUDIT: Customer changes
-- =============================================================================

CREATE TABLE IF NOT EXISTS customer_audit_log (
    audit_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    changed_by_employee_id INTEGER,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_fields TEXT[],
    old_data JSONB,
    new_data JSONB
);

CREATE OR REPLACE FUNCTION audit_customer_changes() RETURNS TRIGGER AS $$
DECLARE
    v_changed TEXT[] := ARRAY[]::TEXT[];
    v_actor TEXT;
    v_actor_id INTEGER;
BEGIN
    -- Collect changed field names (extend as needed)
    IF NEW.first_name IS DISTINCT FROM OLD.first_name THEN v_changed := array_append(v_changed, 'first_name'); END IF;
    IF NEW.last_name  IS DISTINCT FROM OLD.last_name  THEN v_changed := array_append(v_changed, 'last_name');  END IF;
    IF NEW.gender     IS DISTINCT FROM OLD.gender     THEN v_changed := array_append(v_changed, 'gender');     END IF;
    IF NEW.nic        IS DISTINCT FROM OLD.nic        THEN v_changed := array_append(v_changed, 'nic');        END IF;
    IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN v_changed := array_append(v_changed, 'date_of_birth'); END IF;
    IF NEW.contact_id IS DISTINCT FROM OLD.contact_id THEN v_changed := array_append(v_changed, 'contact_id'); END IF;

    IF array_length(v_changed, 1) IS NULL THEN
        RETURN NEW; -- no changes we care about
    END IF;

    v_actor := current_setting('app.actor_employee_id', true);
    IF v_actor IS NOT NULL THEN v_actor_id := v_actor::INTEGER; END IF;

    INSERT INTO customer_audit_log (customer_id, changed_by_employee_id, changed_fields, old_data, new_data)
    VALUES (NEW.customer_id, v_actor_id, v_changed, to_jsonb(OLD), to_jsonb(NEW));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_customer_audit ON customer;
CREATE TRIGGER trigger_customer_audit
    AFTER UPDATE ON customer
    FOR EACH ROW
    EXECUTE FUNCTION audit_customer_changes();

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
CREATE INDEX IF NOT EXISTS idx_fd_interest_fd_id ON fd_interest_calculations(fd_id);
CREATE INDEX IF NOT EXISTS idx_fd_interest_status ON fd_interest_calculations(status);
CREATE INDEX IF NOT EXISTS idx_fd_interest_calculation_date ON fd_interest_calculations(calculation_date);

-- New optimized indexes
CREATE INDEX IF NOT EXISTS idx_transaction_account_time 
ON transaction(account_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_account_branch_status 
ON account(branch_id, account_status);

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
-- Removed legacy monthly period constraints (tables dropped above)

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