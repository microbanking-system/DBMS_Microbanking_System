# 🔧 Database Function Type Casting Fix

## ❌ Error Encountered

```
error: function calculate_fd_interest_due(unknown) does not exist
error: function calculate_savings_interest_due(unknown) does not exist
```

**Error Code:** `42883`
**Hint:** No function matches the given name and argument types. You might need to add explicit type casts.

---

## 🔍 Root Cause

The database functions exist in the schema but PostgreSQL couldn't match the function signature because:

1. **Functions Defined:** 
   - `calculate_fd_interest_due(DATE)` 
   - `calculate_savings_interest_due(DATE)`

2. **Parameters Passed:** 
   - JavaScript string date value (e.g., `'2025-10-19'`)
   - PostgreSQL interpreted it as `unknown` type instead of `DATE`

3. **Type Mismatch:**
   - PostgreSQL strict type system requires explicit casting when parameter types are ambiguous
   - Without `::DATE` cast, the engine couldn't match the function signature

---

## ✅ Solution Applied

### Modified File: `backend/services/interest.js`

#### Fix 1: FD Interest Calculation (Line ~27)

**Before:**
```javascript
const interestCalculations = await client.query(
  `SELECT * FROM calculate_fd_interest_due($1)`,
  [processDate]
);
```

**After:**
```javascript
const interestCalculations = await client.query(
  `SELECT * FROM calculate_fd_interest_due($1::DATE)`,
  [processDate]
);
```

#### Fix 2: Savings Interest Calculation (Line ~116)

**Before:**
```javascript
const interestCalculations = await client.query(
  `SELECT * FROM calculate_savings_interest_due($1)`,
  [processDate]
);
```

**After:**
```javascript
const interestCalculations = await client.query(
  `SELECT * FROM calculate_savings_interest_due($1::DATE)`,
  [processDate]
);
```

---

## 🎯 What Changed

Added PostgreSQL type casting operator `::DATE` to explicitly tell the database that the parameter should be treated as a DATE type:

- `$1` → `$1::DATE`

This ensures PostgreSQL correctly matches the function signature:
- `calculate_fd_interest_due(DATE DEFAULT CURRENT_DATE)`
- `calculate_savings_interest_due(DATE DEFAULT CURRENT_DATE)`

---

## 📊 Database Functions Verified

### Function: `calculate_fd_interest_due`

**Location:** `database/init-postgres.sql` (Line ~495)

```sql
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
-- Calculates FD interest for accounts due based on 30-day cycles
-- Returns only FDs where 30 days have elapsed since last credit
$$
```

### Function: `calculate_savings_interest_due`

**Location:** `database/init-postgres.sql` (Line ~525)

```sql
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
-- Calculates savings interest for accounts due based on 30-day cycles
-- Returns only accounts where 30 days have elapsed since last credit
$$
```

Both functions exist and are properly defined! ✅

---

## 🚀 Testing Steps

### 1. Stop Current Server

```powershell
# Press Ctrl+C in the backend terminal, or:
Stop-Process -Name node -Force
```

### 2. Restart Backend

```powershell
cd backend
npm start
```

### 3. Expected Output (Every Minute in Debug Mode)

#### Successful FD Processing:
```
🚀 Starting daily FD interest processing (30-day per-account cycles)...
💰 Credited LKR 1250.00 interest for FD 1 to account 101
✅ Daily FD interest processing completed!
📊 FDs Processed: 1
💰 Total Interest Credited: LKR 1,250.00
🏁 Matured FDs Processed: 0
💵 Principal Returned: LKR 0
```

#### Successful Savings Processing:
```
🚀 Starting daily savings interest processing (30-day per-account cycles)...
💰 Credited LKR 150.25 interest for account 201 (Adult)
✅ Daily savings interest processing completed!
📊 Accounts Processed: 1
💰 Total Interest Credited: LKR 150.25
📅 Date: 2025-10-19
```

#### No Errors Expected:
- ✅ No `❌ Error in optimized FD interest processing`
- ✅ No `❌ Error in optimized savings interest processing`
- ✅ No `function does not exist` errors

---

## 🔍 Verification Queries

After server restarts and processing runs, check database:

### Check for New Interest Transactions:
```sql
SELECT * FROM transactions 
WHERE transaction_type = 'Interest' 
AND time > NOW() - INTERVAL '5 minutes'
ORDER BY time DESC;
```

### Check FD Interest Calculations:
```sql
SELECT * FROM fd_interest_calculations 
WHERE status = 'credited' 
ORDER BY credited_at DESC 
LIMIT 5;
```

### Check Savings Interest Calculations:
```sql
SELECT * FROM savings_interest_calculations 
WHERE status = 'credited' 
ORDER BY credited_at DESC 
LIMIT 5;
```

---

## 💡 Key Learnings

### PostgreSQL Type Casting

1. **Always cast ambiguous types:**
   - `$1::DATE` for date parameters
   - `$1::INTEGER` for integer parameters
   - `$1::NUMERIC` for decimal parameters

2. **Why casting matters:**
   - JavaScript sends string values
   - PostgreSQL needs explicit type information
   - Prevents "function does not exist" errors

3. **Best practice:**
   ```javascript
   // ❌ Bad - ambiguous type
   client.query(`SELECT * FROM my_function($1)`, [value])
   
   // ✅ Good - explicit type
   client.query(`SELECT * FROM my_function($1::DATE)`, [value])
   ```

### Date Handling in Node.js/PostgreSQL

```javascript
// Current approach (works with ::DATE cast)
const today = new Date();
const processDate = today.toISOString().split('T')[0]; // '2025-10-19'

// Alternative (also works)
const processDate = new Date().toISOString().split('T')[0];

// PostgreSQL receives: '2025-10-19' as string
// With ::DATE cast: Converted to DATE type
// Function matches: calculate_fd_interest_due(DATE)
```

---

## ✅ Fix Complete

The type casting fix has been applied to both interest processing functions. The schedulers should now run without database function errors.

**Next Step:** Restart the backend server and monitor the console for successful interest processing! 🎉
