# Microbanking Database – Complete Guide

This document explains the full PostgreSQL schema and the business rules implemented inside the database for the microbanking system. It’s designed as a viva-ready reference.

- Primary schema file: `database/init-postgres.sql`
- Seed data: `database/insert-interests.sql`, `database/insert-admin.sql`

## Quick start

1) Create your database and run the schema (adjust the `\c` line in `init-postgres.sql`):
- Run `init-postgres.sql` in psql.
2) Seed plans and FD options:
- Run `insert-interests.sql`.
3) Seed an admin user:
- Run `insert-admin.sql` (either step-by-step or the provided CTE block).

Tip: Use a transaction and `SET LOCAL` for session flags when calling guarded functions.

## Enum types

- `gender_type`: Male | Female | Other
- `contact_type`: customer | employee | branch
- `account_status_type`: Active | Closed
- `plan_type`: Children | Teen | Adult | Senior | Joint
- `auto_renewal_status_type`: True | False
- `fd_status_type`: Active | Matured | Closed
- `employee_role`: Manager | Agent | Admin
- `fd_options_type`: '6 months' | '1 year' | '3 years'
- `transaction_type`: Deposit | Withdrawal | Interest

## Tables and relationships

- `Contact`
  - Fields: contact_id (PK), type, contact_no_1, contact_no_2, address, email, created_at
  - Referenced by: `Branch`, `Employee`, `Customer`
- `Branch`
  - Fields: branch_id (PK), name, contact_id (FK → Contact ON DELETE RESTRICT), created_at
- `FDPlan`
  - Fields: fd_plan_id (PK), fd_options, interest, created_at
- `SavingPlan`
  - Fields: saving_plan_id (PK), plan_type, interest, min_balance, created_at
- `FixedDeposit`
  - Fields: fd_id (PK), fd_balance, auto_renewal_status, fd_status, open_date, maturity_date, fd_plan_id (FK), created_at
  - Maturity date auto-calculated when fd_status = 'Active'
- `Employee`
  - Fields: employee_id (PK), role, username (UNIQUE), password, first_name, last_name, nic, gender, date_of_birth, branch_id (FK), contact_id (FK), created_at
  - Trigger enforces minimum age 18+
- `Customer`
  - Fields: customer_id (PK), first_name, last_name, gender, nic, date_of_birth, contact_id (FK), created_at
  - Updates audited (see Audit section)
- `Account`
  - Fields: account_id (PK), open_date, account_status, balance (default 0), saving_plan_id (FK ON DELETE SET NULL), fd_id (FK ON DELETE SET NULL), branch_id (FK), closed_at, created_at
  - Constraints: `UNIQUE(fd_id)` ensures a single Account per FD; no direct balance updates (guard trigger)
- `Transaction`
  - Fields: transaction_id (PK), transaction_type, amount, time, description, account_id (FK), employee_id (FK), created_at
  - BEFORE INSERT trigger validates and applies balance; AFTER INSERT audits success
- `Takes` (Customer↔Account junction)
  - Fields: takes_id (PK), customer_id (FK ON DELETE CASCADE), account_id (FK ON DELETE CASCADE), created_at
  - UNIQUE(customer_id, account_id)
- `fd_interest_calculations`
  - Fields: id (PK), fd_id (FK), calculation_date, interest_amount, days_in_period, credited_to_account_id (FK), credited_at, status, created_at
- `savings_interest_calculations`
  - Fields: id (PK), account_id (FK), calculation_date, interest_amount, interest_rate, plan_type, credited_at, status, created_at
- `transaction_audit_log`
  - Fields: audit_id (PK), transaction_type, amount, attempted_time, description, account_id, employee_id, status, error_message, created_at
- `account_plan_change_audit`
  - Fields: audit_id (PK), account_id, old_saving_plan_id, new_saving_plan_id, reason, changed_by_employee_id (FK), changed_at
- `customer_audit_log`
  - Fields: audit_id (PK), customer_id, changed_by_employee_id, changed_at, changed_fields[], old_data JSONB, new_data JSONB

Key relationships (high level):
- Branch 1–1 Contact
- Employee N–1 Branch; Employee 1–1 Contact
- Customer 1–1 Contact
- Account N–1 Branch; Account 0–1 SavingPlan; Account 0–1 FixedDeposit (unique)
- Takes maps Customer N–M Account
- FixedDeposit N–1 FDPlan
- Transaction N–1 Account, N–1 Employee

## Business rules and guards

Session flags (set per transaction) enable controlled updates:
- `app.balance_update_allowed` + `app.balance_update_account_id` — for balance updates
- `app.plan_change_allowed` + `app.plan_change_account_id` — for plan changes
- `app.actor_employee_id` — actor identity for audit trails

Use `SET LOCAL` to scope them to the current transaction.

### Balance updates are only via Transaction
- Trigger: `trigger_account_balance_guard` on `Account` (BEFORE UPDATE)
- Any direct balance change is rejected unless the session flags match the account (set by function below)

### Account state and plan change guard
- Trigger: `trigger_account_status` on `Account` (BEFORE INSERT/UPDATE of balance, saving_plan_id)
- Prevents negative balances
- Blocks saving plan changes unless session flags are set (use `change_account_saving_plan`)

### Employee minimum age
- Trigger: `trg_employee_min_age` on `Employee` — enforces 18+

### Transaction validation and application
- BEFORE INSERT: `transaction_validate_and_apply`
  - amount > 0; time not older than 1 day and not >5 min in the future
  - Allowed types: Deposit | Withdrawal | Interest
  - Blocks transactions on Closed accounts
  - Special-case: withdrawal with description containing "Account Closure" skips auto balance application (to avoid double-subtraction when the app pre-zeroes the account)
  - Calls `update_account_balance(...)` to apply balance/min-balance checks
- AFTER INSERT: `audit_transaction_success` writes a success row to `transaction_audit_log`

### FD maturity date auto-calc
- Trigger: `trigger_fd_autocalc_maturity` on `FixedDeposit` (BEFORE INSERT/UPDATE)
- When fd_status='Active', sets maturity_date = open_date + duration per FD plan

### Customer and Contact auditing
- `trigger_customer_audit` on `Customer`: diffs key fields, stores old/new JSONB with actor id
- `trigger_customer_contact_audit` on `Contact` (type='customer'): audits contact field changes for all linked customers

## Core functions

- `update_account_balance(p_account_id, p_amount, p_transaction_type)`
  - Internal engine for applying Deposit/Interest (+) and Withdrawal (−) with min-balance check
  - Uses session flags to permit the guarded UPDATE of `Account.balance`

- `create_transaction_with_validation(p_type, p_amount, p_description, p_account_id, p_employee_id)`
  - Inserts a row into `Transaction`; BEFORE trigger then enforces rules and applies balance changes

- `calculate_fd_interest_period(p_start, p_end)`
  - Computes monthly interest (uses fixed 30-day factor) for Active FDs on Active accounts

- `calculate_savings_interest_period(p_start, p_end)`
  - Computes monthly savings interest (fixed 30-day factor) for Active accounts that meet min_balance

- `calculate_fd_interest_due(p_as_of_date default CURRENT_DATE)`
  - Returns FDs due for interest if 30 days since last credited (or open_date if none)

- `calculate_savings_interest_due(p_as_of_date default CURRENT_DATE)`
  - Returns savings accounts due for interest if 30 days since last credited (or account.open_date if none), excludes accounts with an FD, and requires min_balance

- `process_matured_fixed_deposits()`
  - For each FD with maturity_date <= today:
    - If auto_renewal_status='True': roll open_date and maturity_date forward
    - Else: deposit principal back to linked Account, set FD to Closed, unlink from Account
  - Returns processed_count and total_principal_returned

- `change_account_saving_plan(p_account_id, p_new_saving_plan_id, p_actor_employee_id, p_reason, p_new_nic default NULL)`
  - Validates: Active account, has a plan, no Joint involvement, no downgrades, age thresholds (Children→Teen 12+, Teen→Adult 18+, Adult→Senior 60+), and min_balance of the new plan
  - Optionally updates owner NIC (≤30 chars)
  - Performs guarded update and writes audit

- `refresh_materialized_views()`
  - Concurrently refreshes reporting MVs

## Interest processing flows

- Savings interest
  1) `SELECT * FROM calculate_savings_interest_due(CURRENT_DATE);`
  2) For each due account, insert a row into `savings_interest_calculations` with status 'pending'
  3) Call `create_transaction_with_validation('Interest', amount, 'Monthly Savings Interest', account_id, employee_id)`
  4) Mark the calculation row as `status='credited'`, set `credited_at=NOW()`

- FD interest
  1) `SELECT * FROM calculate_fd_interest_due(CURRENT_DATE);`
  2) For each due FD, insert a row into `fd_interest_calculations` with status 'pending'
  3) Call `create_transaction_with_validation('Interest', amount, 'FD Interest', linked_account_id, employee_id)`
  4) Mark the calculation row `status='credited'`, set `credited_at=NOW()`

- FD maturity
  - `SELECT * FROM process_matured_fixed_deposits();`
  - Auto-renew rolls dates; non-renew returns principal to the Account and closes the FD

## Saving plan change policy

- Upgrade-only path with age thresholds:
  - Children → Teen (age ≥ 12)
  - Teen → Adult (age ≥ 18)
  - Adult → Senior (age ≥ 60)
  - Senior → Adult is disallowed (no downgrades)
- No Joint plan involvement for plan changes (from/to Joint blocked)
- New plan’s `min_balance` must be met by current balance
- Use: `SELECT change_account_saving_plan(acc_id, new_plan_id, actor_emp_id, 'reason', NULL);`

## Reporting (materialized views)

- `mv_daily_account_summary`
  - Per account: balance, status, plan_type, transaction_count (last 30 days), total_deposits/withdrawals (last 30 days), last_transaction_date
  - UNIQUE index on `(account_id)` allows `CONCURRENTLY` refresh

- `mv_fd_performance`
  - Per FD option: active_count, total_principal (active FDs), avg_interest_rate, interest_payments_count, total_interest_paid (credited)
  - UNIQUE index on `(fd_options)`

Refresh both via: `SELECT refresh_materialized_views();`

## Indexes (highlights)

- Employee: `username`, `role`, `(branch_id, role)`
- Customer: `nic`
- Account: `account_status`, `branch_id`, `fd_id`, partial `idx_active_accounts` (Active only)
- Transaction: `account_id`, `time`, `employee_id`, composite `(account_id, time DESC)`, partial `idx_recent_transactions`
- Takes: `customer_id`, `account_id`, composite `(customer_id, account_id)`
- FixedDeposit: `fd_status`, composite `(fd_status, maturity_date)` where active
- Contact: `type`
- Interest calc tables: keys on ids, status and dates for filtering
- MV unique indexes

## Constraints and integrity

- `UNIQUE(fd_id)` on `Account` ensures one account owns at most one FD, and an FD isn’t shared
- Conservative deletes: mostly RESTRICT/SET NULL; `Takes` uses CASCADE to clean links
- Negative balances blocked; min-balance enforced on withdrawals
- Transactions on Closed accounts are blocked

## Common SQL examples

- List Saving plans and FD plans
  - `SELECT saving_plan_id, plan_type, interest, min_balance FROM SavingPlan ORDER BY saving_plan_id;`
  - `SELECT fd_plan_id, fd_options, interest FROM FDPlan ORDER BY fd_plan_id;`

- Accounts due for savings interest today
  - `SELECT * FROM calculate_savings_interest_due(CURRENT_DATE);`

- FDs due for interest today
  - `SELECT * FROM calculate_fd_interest_due(CURRENT_DATE);`

- Process matured FDs
  - `SELECT * FROM process_matured_fixed_deposits();`

- Credit savings interest for one account (pattern)
  - BEGIN;
  - `SET LOCAL app.actor_employee_id = '1';`
  - `INSERT INTO savings_interest_calculations (account_id, calculation_date, interest_amount, interest_rate, plan_type, status)
     VALUES (123, CURRENT_DATE, 250.00, 10.00, 'Adult', 'pending') RETURNING id;`
  - `SELECT create_transaction_with_validation('Interest', 250.00, 'Monthly Savings Interest', 123, 1);`
  - `UPDATE savings_interest_calculations SET status='credited', credited_at=NOW() WHERE id = <returned_id>;`
  - COMMIT;

- Change plan (Teen → Adult @ 18+)
  - `SELECT change_account_saving_plan(123, <adult_plan_id>, 1, 'Customer turned 18', NULL);`

- Refresh reporting MVs
  - `SELECT refresh_materialized_views();`

- Inspect recent transaction audit
  - `SELECT * FROM transaction_audit_log ORDER BY audit_id DESC LIMIT 50;`

## Seeding data

- `insert-interests.sql`
  - SavingPlan: Children (12%, min 0), Teen (11%, min 500), Adult (10%, min 1000), Senior (13%, min 1000), Joint (7%, min 5000)
  - FDPlan: 6 months (13%), 1 year (14%), 3 years (15%)

- `insert-admin.sql`
  - Creates an employee contact, a Main Branch, and an Admin user (username `admin`, bcrypt-hashed password)
  - You may use the stepwise inserts or the provided CTE-based single-transaction variant

## Viva cheat-sheet

- Why triggers for balance updates? Centralizes rules (min balance, negative balance block), enforces auditable Transactions, prevents accidental edits.
- How is interest scheduled? Fixed 30-day cycle. “Due” functions identify accounts/FDs due based on last credited date or open_date; app then credits via Transactions and marks calculation rows as credited.
- How are plan changes controlled? `change_account_saving_plan` enforces age thresholds, blocks downgrades and any Joint involvement, checks min_balance, sets session flags, and audits.
- What are session flags for? To permit specific guarded updates within the current transaction; they automatically clear at transaction end when set via `SET LOCAL`.
- What ensures performance? Targeted indexes, partial indexes for hot paths, materialized views for reporting, and conservative constraints.

---

For details, see the inline definitions and comments in `database/init-postgres.sql`.
