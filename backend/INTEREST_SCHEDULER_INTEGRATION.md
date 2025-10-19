# Interest Scheduler Integration Guide

## 📋 Overview

This guide documents the integration of automated interest processing schedulers into the refactored B-Trust Microbanking System.

## 🏗️ Project Structure

```
backend/
├── index.js                          # Main application entry (updated)
├── services/
│   └── interest.js                   # Interest processing logic (NEW)
├── schedulers/
│   └── interestScheduler.js          # Cron job scheduler (NEW)
└── utils/
    └── logger.js                     # Logging utility (NEW)
```

## ✅ Task 1: Scheduler Integration

### Files Created

#### 1. `services/interest.js`
Contains the core interest processing logic:
- `processDailyFDInterest()` - Processes Fixed Deposit interest
- `processDailySavingsInterest()` - Processes Savings Account interest

**Features:**
- 30-day cycle calculations per account
- Automatic interest crediting via transactions
- Matured FD processing with principal return
- Detailed logging with emoji indicators
- Error handling with failed calculation tracking
- Transaction rollback on errors

#### 2. `schedulers/interestScheduler.js`
Manages the cron job scheduling:
- `startInterestSchedulers()` - Initializes both schedulers

**Configuration:**
```env
# Production: Run at 3:00 AM and 3:30 AM daily
FD_INTEREST_CRON=0 3 * * *
SAVINGS_INTEREST_CRON=30 3 * * *

# Debug: Run every minute for testing
INTEREST_CRON_DEBUG=1
```

**Cron Schedule Examples:**
```
'0 3 * * *'     - Every day at 3:00 AM
'30 3 * * *'    - Every day at 3:30 AM
'* * * * *'     - Every minute (DEBUG mode)
'0 */6 * * *'   - Every 6 hours
'0 0 1 * *'     - First day of month at midnight
```

#### 3. `utils/logger.js` (Optional)
Provides clean console output control:
- Filters non-interest logs when configured
- Always shows interest-related messages (with emojis)
- Configurable log levels

### Integration in `index.js`

**Added imports:**
```javascript
const { startInterestSchedulers } = require('./schedulers/interestScheduler');
```

**Added initialization:**
```javascript
// Inside app.listen() callback, after database verification
try {
  startInterestSchedulers();
  console.log('✅ Interest schedulers initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize interest schedulers:', error.message);
  console.error('   Interest processing will not run automatically.');
  console.error('   Check that node-cron is installed: npm install node-cron');
}
```

## ✅ Task 2: Clean Console Output

### Logging Strategy

#### Option A: Environment Variable Control (Recommended - Simple)

Add to your `.env` file:
```env
# Suppress general HTTP request logs
SUPPRESS_GENERAL_LOGS=1

# Set log level (silent, error, warn, info, debug)
LOG_LEVEL=info

# Debug mode for interest processing (runs every minute)
INTEREST_CRON_DEBUG=0
```

**Result:**
- HTTP request logs are suppressed (morgan uses 'combined' instead of 'dev')
- Interest logs (with emojis 🚀, ✅, 💰, 📊, etc.) are ALWAYS visible
- Error logs are always visible

#### Option B: Advanced Logger Utility (Available but Optional)

Uncomment these lines in `index.js`:
```javascript
const { getMorganFormat, setupConsoleOverride } = require('./utils/logger');
setupConsoleOverride(); // Suppress non-interest console.log calls
```

And change morgan line to:
```javascript
app.use(morgan(getMorganFormat()));
```

### Interest Log Emojis (Always Visible)

The following emojis mark interest-related logs:
- 🚀 - Process starting
- ✅ - Process completed successfully
- 💰 - Interest credited
- 📊 - Summary statistics
- 🏁 - Matured FDs processed
- 💵 - Principal returned
- ❌ - Error occurred
- ⏰ - Scheduler initialized
- ⚠️ - Warning/Debug mode

## 📦 Dependencies Required

Make sure these are installed:

```bash
cd backend
npm install node-cron
```

Check `package.json`:
```json
{
  "dependencies": {
    "node-cron": "^3.0.0"
  }
}
```

## 🚀 Usage

### Starting the Server

```bash
cd backend
npm start
```

**Expected console output:**
```
============================================================
🚀 B-Trust Microbanking System API Server
============================================================
📍 Server running on port: 5000
🌍 Environment: development
⏰ Started at: 2025-10-19T10:30:00.000Z
============================================================
✅ Database connection verified
✅ Interest schedulers initialized successfully

⏰ INTEREST SCHEDULERS INITIALIZED
============================================================
✅ FD Interest Processor: Scheduled at '0 3 * * *'
✅ Savings Interest Processor: Scheduled at '30 3 * * *'
============================================================

============================================================
```

### Testing the Schedulers

#### Method 1: Debug Mode (Recommended for Testing)

Add to `.env`:
```env
INTEREST_CRON_DEBUG=1
```

**Result:** Both schedulers run every minute

**Console output:**
```
⚠️  DEBUG MODE: Interest processors set to run EVERY MINUTE
⚠️  Set INTEREST_CRON_DEBUG=0 in production!
✅ FD Interest Processor: Scheduled at '* * * * *'
✅ Savings Interest Processor: Scheduled at '* * * * *'

(After 1 minute)
🚀 Starting daily FD interest processing (30-day per-account cycles)...
💰 Credited LKR 1250.00 interest for FD 1 to account 101
💰 Credited LKR 2100.50 interest for FD 3 to account 103
✅ Daily FD interest processing completed!
📊 FDs Processed: 2
💰 Total Interest Credited: LKR 3,350.50
🏁 Matured FDs Processed: 0
💵 Principal Returned: LKR 0
```

#### Method 2: Custom Schedule

Add to `.env`:
```env
# Run every 5 minutes for testing
FD_INTEREST_CRON=*/5 * * * *
SAVINGS_INTEREST_CRON=*/5 * * * *
```

#### Method 3: Production Schedule

Remove or set to 0:
```env
INTEREST_CRON_DEBUG=0
```

Uses default schedule:
- FD Interest: Daily at 3:00 AM
- Savings Interest: Daily at 3:30 AM

## 🔍 Monitoring

### Check if Schedulers are Running

Look for these logs on server startup:
```
✅ Interest schedulers initialized successfully
⏰ INTEREST SCHEDULERS INITIALIZED
✅ FD Interest Processor: Scheduled at '...'
✅ Savings Interest Processor: Scheduled at '...'
```

### Interest Processing Logs

**FD Interest Processing:**
```
🚀 Starting daily FD interest processing (30-day per-account cycles)...
💰 Credited LKR XXX interest for FD Y to account Z
✅ Daily FD interest processing completed!
📊 FDs Processed: N
💰 Total Interest Credited: LKR X,XXX
🏁 Matured FDs Processed: N
💵 Principal Returned: LKR X,XXX
```

**Savings Interest Processing:**
```
🚀 Starting daily savings interest processing (30-day per-account cycles)...
💰 Credited LKR XXX interest for account Y (Plan Type)
✅ Daily savings interest processing completed!
📊 Accounts Processed: N
💰 Total Interest Credited: LKR X,XXX
📅 Date: YYYY-MM-DD
```

### Error Handling

If a scheduler fails:
```
❌ Failed to process interest for FD 123: Error message
❌ FD Interest Scheduler Error: Error message
```

These errors are logged but don't crash the server.

## 🛠️ Troubleshooting

### Schedulers Don't Start

**Problem:** No scheduler logs appear on startup

**Solutions:**
1. Check `node-cron` is installed:
   ```bash
   npm list node-cron
   ```
   If not installed:
   ```bash
   npm install node-cron
   ```

2. Check for initialization errors:
   ```
   ❌ Failed to initialize interest schedulers: ...
   ```

3. Verify file paths are correct in `index.js`

### Interest Not Processing

**Problem:** Schedulers initialize but no processing happens

**Solutions:**
1. Enable debug mode to test every minute:
   ```env
   INTEREST_CRON_DEBUG=1
   ```

2. Check database functions exist:
   ```sql
   SELECT * FROM calculate_fd_interest_due(CURRENT_DATE);
   SELECT * FROM calculate_savings_interest_due(CURRENT_DATE);
   ```

3. Check database tables exist:
   - `fd_interest_calculations`
   - `savings_interest_calculations`

### Too Many Logs

**Problem:** Console is cluttered with HTTP requests and other logs

**Solutions:**
1. Add to `.env`:
   ```env
   SUPPRESS_GENERAL_LOGS=1
   ```

2. Or use the logger utility (uncomment in `index.js`):
   ```javascript
   const { setupConsoleOverride } = require('./utils/logger');
   setupConsoleOverride();
   ```

### Logs Not Showing

**Problem:** Interest logs are not visible

**Solutions:**
1. Remove or set to 0:
   ```env
   SUPPRESS_GENERAL_LOGS=0
   LOG_LEVEL=info
   ```

2. Check console output is not being redirected

## 📊 Database Schema Requirements

The schedulers require these database functions:

### Required Functions
```sql
-- Calculate FD interest due
CREATE OR REPLACE FUNCTION calculate_fd_interest_due(process_date DATE)

-- Calculate savings interest due
CREATE OR REPLACE FUNCTION calculate_savings_interest_due(process_date DATE)

-- Process matured FDs
CREATE OR REPLACE FUNCTION process_matured_fixed_deposits()

-- Create transaction
CREATE OR REPLACE FUNCTION create_transaction_with_validation(...)
```

### Required Tables
```sql
-- FD interest calculations history
CREATE TABLE fd_interest_calculations (...)

-- Savings interest calculations history
CREATE TABLE savings_interest_calculations (...)
```

## 🔐 Security Considerations

1. **Environment Variables:**
   - Never commit `.env` file to version control
   - Use different cron schedules for dev/staging/prod

2. **Debug Mode:**
   - ALWAYS disable in production: `INTEREST_CRON_DEBUG=0`
   - Running every minute in production can cause duplicate processing

3. **Database Transactions:**
   - All processing uses BEGIN/COMMIT/ROLLBACK
   - Failed calculations are logged but don't affect successful ones

4. **Error Handling:**
   - Individual errors don't crash the entire process
   - Failed calculations are recorded with 'failed' status

## 📝 Configuration Summary

### Minimal Setup (.env)
```env
# Required
PORT=5000
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Optional - Interest Scheduler
INTEREST_CRON_DEBUG=0
FD_INTEREST_CRON=0 3 * * *
SAVINGS_INTEREST_CRON=30 3 * * *

# Optional - Clean Logs
SUPPRESS_GENERAL_LOGS=1
LOG_LEVEL=info
```

### Production Setup (.env)
```env
NODE_ENV=production
INTEREST_CRON_DEBUG=0
SUPPRESS_GENERAL_LOGS=1
LOG_LEVEL=info
```

### Development/Testing Setup (.env)
```env
NODE_ENV=development
INTEREST_CRON_DEBUG=1
SUPPRESS_GENERAL_LOGS=0
LOG_LEVEL=debug
```

## 🎯 Summary

### What Was Added

✅ **Services:**
- `services/interest.js` - Core interest processing logic

✅ **Schedulers:**
- `schedulers/interestScheduler.js` - Cron job management

✅ **Utilities:**
- `utils/logger.js` - Optional clean logging utility

✅ **Integration:**
- Updated `index.js` with scheduler initialization
- Added proper error handling
- Added environment variable controls

### What Was Achieved

✅ **Task 1 - Integration:**
- Interest schedulers properly integrated into main app
- Automatic startup with server
- Configurable via environment variables
- Error handling that doesn't crash server

✅ **Task 2 - Clean Logs:**
- Interest logs always visible (with emoji indicators)
- General logs can be suppressed
- HTTP request logs can be minimized
- Configurable log levels

### Production Checklist

Before deploying:
- [ ] Set `INTEREST_CRON_DEBUG=0`
- [ ] Verify cron schedules are appropriate
- [ ] Test database functions exist
- [ ] Verify `node-cron` is in `package.json`
- [ ] Test with debug mode first
- [ ] Monitor first execution in production
- [ ] Set up log rotation if needed

## 🆘 Support

If issues persist:
1. Check all files are in correct locations
2. Verify all dependencies are installed
3. Check database functions exist and work
4. Test in debug mode first
5. Review error logs carefully

---

**Integration completed on:** October 19, 2025
**Tested and verified:** ✅
**Production ready:** ✅
