# 🎯 Interest Scheduler - Quick Testing Commands

## ✅ Setup Complete! Ready to Test

**Status:** Database import fixed. Schedulers configured in DEBUG mode (runs every minute).

---

## 1️⃣ Stop & Restart Server

### Stop Current Server
```powershell
# Option 1: In terminal where server is running
Ctrl+C

# Option 2: Kill all node processes
Stop-Process -Name node -Force
```

### Start Server
```powershell
cd backend
npm start
```

### ✅ Expected Output
```
============================================================
🚀 B-Trust Microbanking System API Server
============================================================
✅ Connected to PostgreSQL database

⏰ INTEREST SCHEDULERS INITIALIZED
============================================================
⚠️  DEBUG MODE: Interest processors set to run EVERY MINUTE
✅ FD Interest Processor: Scheduled at '* * * * *'
✅ Savings Interest Processor: Scheduled at '* * * * *'
============================================================
```

---

## 2️⃣ Watch Console Logs

### Every ~60 seconds, you should see:

#### FD Interest Processing:
```
🚀 Starting daily FD interest processing (30-day per-account cycles)...
💰 Credited LKR 1250.00 interest for FD 1 to account 101
💰 Credited LKR 2100.50 interest for FD 3 to account 103
✅ Daily FD interest processing completed!
📊 FDs Processed: 2
💰 Total Interest Credited: LKR 3,350.50
```

#### Savings Interest Processing:
```
🚀 Starting daily savings interest processing (30-day per-account cycles)...
💰 Credited LKR 150.25 interest for account 201 (Adult)
✅ Daily savings interest processing completed!
📊 Accounts Processed: 1
💰 Total Interest Credited: LKR 150.25
```

---

## 3️⃣ Database Verification Commands

### Connect to PostgreSQL:
```powershell
psql -U postgres -d b_trust_microbanking
```

### Check Recent Interest Transactions:
```sql
SELECT 
    transaction_id,
    account_id,
    transaction_type,
    amount,
    time,
    description
FROM Transactions
WHERE transaction_type = 'Interest'
ORDER BY time DESC
LIMIT 10;
```

### Check FD Interest Calculations:
```sql
SELECT 
    fd_id,
    calculation_date,
    interest_amount,
    days_in_period,
    credited_to_account_id,
    status,
    credited_at
FROM fd_interest_calculations
ORDER BY calculation_date DESC, credited_at DESC
LIMIT 10;
```

### Check Savings Interest Calculations:
```sql
SELECT 
    account_id,
    calculation_date,
    interest_amount,
    interest_rate,
    plan_type,
    status,
    credited_at
FROM savings_interest_calculations
ORDER BY calculation_date DESC, credited_at DESC
LIMIT 10;
```

### Check Account Balances:
```sql
SELECT 
    a.account_id,
    a.balance,
    a.account_type,
    COUNT(t.transaction_id) as interest_count
FROM Accounts a
LEFT JOIN Transactions t ON a.account_id = t.account_id 
    AND t.transaction_type = 'Interest'
    AND t.time > NOW() - INTERVAL '10 minutes'
GROUP BY a.account_id, a.balance, a.account_type
HAVING COUNT(t.transaction_id) > 0
ORDER BY a.account_id;
```

### Test Database Functions Manually:
```sql
-- See which FDs are due for interest
SELECT * FROM calculate_fd_interest_due(CURRENT_DATE);

-- See which savings accounts are due for interest
SELECT * FROM calculate_savings_interest_due(CURRENT_DATE);

-- Check matured FDs
SELECT * FROM process_matured_fixed_deposits(CURRENT_DATE);
```

---

## 4️⃣ Troubleshooting Commands

### Check if Port 5000 is in Use:
```powershell
# See what's using port 5000
Get-NetTCPConnection -LocalPort 5000 -State Listen | 
Select-Object LocalAddress, LocalPort, OwningProcess, 
@{Name="ProcessName";Expression={(Get-Process -Id $_.OwningProcess).ProcessName}}
```

### Kill Process on Port 5000:
```powershell
# Get process ID
$processId = (Get-NetTCPConnection -LocalPort 5000 -State Listen).OwningProcess

# Kill the process
Stop-Process -Id $processId -Force
```

### Check Node Processes:
```powershell
Get-Process -Name node | Select-Object Id, ProcessName, StartTime
```

### View Full Environment Variables:
```powershell
cd backend
Get-Content .env
```

---

## 5️⃣ Production Mode Switch

### When Testing is Complete:

#### Update `.env`:
```env
# Change this line:
INTEREST_CRON_DEBUG=0  # Was: 1

# Keep these:
FD_INTEREST_CRON=0 3 * * *
SAVINGS_INTEREST_CRON=30 3 * * *
SUPPRESS_GENERAL_LOGS=1
LOG_LEVEL=info
```

#### Restart Server:
```powershell
# Stop server (Ctrl+C or)
Stop-Process -Name node -Force

# Start again
cd backend
npm start
```

#### Verify Production Mode:
```
✅ FD Interest Processor: Scheduled at '0 3 * * *'
✅ Savings Interest Processor: Scheduled at '30 3 * * *'
```

**⚠️ No "DEBUG MODE" warning should appear!**

---

## 6️⃣ Testing Checklist

Run server and check off each item:

- [ ] Server starts without errors
- [ ] "INTEREST SCHEDULERS INITIALIZED" appears
- [ ] No ❌ errors in console
- [ ] FD processing runs every minute (in debug mode)
- [ ] Savings processing runs every minute (in debug mode)
- [ ] Interest transactions appear in database
- [ ] Calculation records appear in database
- [ ] Account balances increase correctly
- [ ] Console shows emoji logs (🚀, 💰, ✅, 📊)

### If Everything Works:
- [ ] Switch to production mode (DEBUG=0)
- [ ] Restart and verify production schedule
- [ ] Monitor first run at 3:00 AM

---

## 7️⃣ Expected Processing Behavior

### 30-Day Cycle Logic:
- Each account/FD has its own cycle
- Only accounts that reached 30 days are processed
- Processing date is tracked in calculation tables
- Next processing happens 30 days after last credit

### Example Timeline:
```
Day 0:  FD opened (2025-01-01)
Day 30: First interest credited (2025-01-31)
Day 60: Second interest credited (2025-03-02)
Day 90: Third interest credited (2025-04-01)
```

### If No Accounts Processed:
This is **NORMAL** if no accounts have reached their 30-day mark yet:
```
🚀 Starting daily FD interest processing...
✅ Daily FD interest processing completed!
📊 FDs Processed: 0
💰 Total Interest Credited: LKR 0
```

---

## 8️⃣ Monitoring Tips

### Watch Logs in Real-Time:
- Keep terminal visible
- Note the exact minute when processing happens
- Check for any ❌ error emojis

### Check Database After Each Run:
- Open DB client (pgAdmin, DBeaver, or psql)
- Refresh transactions table
- Watch balance changes

### Track Processing Count:
```sql
-- Count today's interest transactions
SELECT 
    transaction_type,
    COUNT(*) as count,
    SUM(amount) as total
FROM Transactions
WHERE transaction_type = 'Interest'
AND DATE(time) = CURRENT_DATE
GROUP BY transaction_type;
```

---

## 📚 Full Documentation

- **Complete Guide:** `INTEREST_SCHEDULER_INTEGRATION.md`
- **Architecture:** `SCHEDULER_ARCHITECTURE_DIAGRAM.md`
- **Quick Start:** `QUICK_START_SCHEDULERS.md`
- **All API Tests:** `TESTING_GUIDE.md`

---

## ✨ Quick Summary

**Right now:**
1. Stop current server: `Ctrl+C`
2. Start fresh: `cd backend; npm start`
3. Watch console for interest processing every minute
4. Check database for new transactions
5. Test for 5-10 minutes
6. Switch to production: Set `INTEREST_CRON_DEBUG=0`

**You're all set! Happy testing! 🚀**
