# Interest Scheduler Architecture Diagram

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                         B-TRUST BACKEND SERVER                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌─────────────────────┐       ┌──────────────────────┐
        │    index.js         │       │   Express Routes     │
        │  (Main Entry)       │       │  /api/auth, etc.     │
        └─────────────────────┘       └──────────────────────┘
                    │
                    │ startInterestSchedulers()
                    │
                    ▼
        ┌─────────────────────────────────────────────┐
        │  schedulers/interestScheduler.js            │
        │  ┌─────────────────────────────────────┐   │
        │  │  cron.schedule(FD_CRON, ...)        │   │
        │  │  cron.schedule(SAVINGS_CRON, ...)   │   │
        │  └─────────────────────────────────────┘   │
        └─────────────────────────────────────────────┘
                    │                    │
        ┌───────────┴──────────┐         │
        │                      │         │
        ▼                      ▼         ▼
    Every Day              Every Day
    at 3:00 AM            at 3:30 AM
        │                      │
        ▼                      ▼
┌───────────────────┐   ┌──────────────────────┐
│ services/         │   │ services/            │
│ interest.js       │   │ interest.js          │
│                   │   │                      │
│ processDailyFD    │   │ processDailySavings  │
│ Interest()        │   │ Interest()           │
└───────────────────┘   └──────────────────────┘
        │                      │
        │                      │
        └──────────┬───────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │    PostgreSQL       │
        │    Database         │
        │                     │
        │  • Accounts         │
        │  • Transactions     │
        │  • Fixed Deposits   │
        │  • Interest Calcs   │
        └─────────────────────┘
```

## 🔄 Processing Flow

### FD Interest Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER (3:00 AM Daily or Every Minute in Debug)            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. START TRANSACTION                                            │
│    BEGIN;                                                       │
│    🚀 Starting daily FD interest processing...                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CALCULATE INTEREST DUE                                       │
│    SELECT * FROM calculate_fd_interest_due(CURRENT_DATE)        │
│    Returns: fd_id, interest_amount, rate, days, account_id      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. FOR EACH FD WITH INTEREST DUE                                │
│    ┌─────────────────────────────────────────────────┐         │
│    │ a) Create transaction (credit to savings)       │         │
│    │    create_transaction_with_validation()          │         │
│    │    💰 Credited LKR XXX to account YYY           │         │
│    │                                                  │         │
│    │ b) Record calculation                            │         │
│    │    INSERT INTO fd_interest_calculations          │         │
│    │    status = 'credited'                           │         │
│    └─────────────────────────────────────────────────┘         │
│                                                                 │
│    On error for individual FD:                                  │
│    ┌─────────────────────────────────────────────────┐         │
│    │ • Log error ❌                                   │         │
│    │ • Record as 'failed' in database                 │         │
│    │ • Continue to next FD (don't rollback all)       │         │
│    └─────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. PROCESS MATURED FDs                                          │
│    SELECT * FROM process_matured_fixed_deposits()               │
│    • Returns principal to linked accounts                       │
│    • Updates FD status to 'Matured'                             │
│    🏁 Matured FDs Processed: N                                  │
│    💵 Principal Returned: LKR X,XXX                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. COMMIT TRANSACTION                                           │
│    COMMIT;                                                      │
│    ✅ Daily FD interest processing completed!                   │
│    📊 FDs Processed: N                                          │
│    💰 Total Interest Credited: LKR X,XXX                        │
└─────────────────────────────────────────────────────────────────┘
```

### Savings Interest Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER (3:30 AM Daily or Every Minute in Debug)            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. START TRANSACTION                                            │
│    BEGIN;                                                       │
│    🚀 Starting daily savings interest processing...             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CALCULATE INTEREST DUE                                       │
│    SELECT * FROM calculate_savings_interest_due(CURRENT_DATE)   │
│    Returns: account_id, interest_amount, rate, plan_type        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. FOR EACH ACCOUNT WITH INTEREST DUE                           │
│    ┌─────────────────────────────────────────────────┐         │
│    │ a) Create transaction (credit to same account)  │         │
│    │    create_transaction_with_validation()          │         │
│    │    💰 Credited LKR XXX to account YYY (Plan)    │         │
│    │                                                  │         │
│    │ b) Record calculation                            │         │
│    │    INSERT INTO savings_interest_calculations     │         │
│    │    status = 'credited'                           │         │
│    └─────────────────────────────────────────────────┘         │
│                                                                 │
│    On error for individual account:                             │
│    ┌─────────────────────────────────────────────────┐         │
│    │ • Log error ❌                                   │         │
│    │ • Record as 'failed' in database                 │         │
│    │ • Continue to next account                       │         │
│    └─────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. COMMIT TRANSACTION                                           │
│    COMMIT;                                                      │
│    ✅ Daily savings interest processing completed!              │
│    📊 Accounts Processed: N                                     │
│    💰 Total Interest Credited: LKR X,XXX                        │
│    📅 Date: YYYY-MM-DD                                          │
└─────────────────────────────────────────────────────────────────┘
```

## 🎛️ Configuration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        .env FILE                                │
│                                                                 │
│  INTEREST_CRON_DEBUG=1      ← Set to 1 for testing             │
│  FD_INTEREST_CRON=0 3 * * * ← Production schedule               │
│  SAVINGS_INTEREST_CRON=...  ← Production schedule               │
│  SUPPRESS_GENERAL_LOGS=1    ← Clean console output             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              schedulers/interestScheduler.js                    │
│                                                                 │
│  const debug = process.env.INTEREST_CRON_DEBUG === '1'         │
│  const FD_CRON = debug ? '* * * * *' : (env || '0 3 * * *')   │
│                                                                 │
│  if (debug) {                                                   │
│    ⚠️  DEBUG MODE: Every minute                                 │
│  } else {                                                       │
│    ✅ Production schedule                                       │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CRON SCHEDULER                                │
│                                                                 │
│  Debug:        * * * * *       (Every minute)                   │
│  Production:   0 3 * * *       (3:00 AM daily)                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔍 Logging Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOGGING DECISION                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴──────────┐
                │                      │
                ▼                      ▼
      ┌──────────────────┐   ┌──────────────────┐
      │ Interest Log?    │   │ General Log?     │
      │ (has emoji)      │   │ (no emoji)       │
      └──────────────────┘   └──────────────────┘
                │                      │
                │                      │
                ▼                      ▼
      ┌──────────────────┐   ┌──────────────────┐
      │ ALWAYS SHOW      │   │ Check Config     │
      │ (unless silent)  │   │                  │
      └──────────────────┘   └──────────────────┘
                                      │
                        ┌─────────────┴────────────┐
                        │                          │
                        ▼                          ▼
              ┌──────────────────┐    ┌─────────────────┐
              │ SUPPRESS=1?      │    │ SUPPRESS=0?     │
              │ → HIDE           │    │ → SHOW          │
              └──────────────────┘    └─────────────────┘

Examples:

🚀 Starting FD processing...           → ALWAYS SHOWN (interest emoji)
💰 Credited LKR 100...                 → ALWAYS SHOWN (interest emoji)
GET /api/agent/accounts 200            → HIDDEN if SUPPRESS=1
Database connection verified           → HIDDEN if SUPPRESS=1
❌ Error in FD processing              → ALWAYS SHOWN (error)
```

## 📊 Database Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION                              │
│                  (services/interest.js)                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴──────────┐
                │                      │
                ▼                      ▼
┌────────────────────────┐   ┌─────────────────────────┐
│ FD Interest            │   │ Savings Interest        │
│ Processing             │   │ Processing              │
└────────────────────────┘   └─────────────────────────┘
                │                      │
                └──────────┬───────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │  PostgreSQL Pool    │
                │  (db.js)            │
                └─────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌────────────────┐  ┌──────────────┐
│ Accounts     │  │ Transactions   │  │ Interest     │
│ Table        │  │ Table          │  │ Calculations │
└──────────────┘  └────────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │  Database           │
                │  Functions          │
                │                     │
                │  • calculate_fd_    │
                │    interest_due()   │
                │  • calculate_       │
                │    savings_...()    │
                │  • process_matured  │
                │    _fds()           │
                │  • create_trans...()│
                └─────────────────────┘
```

## 🎯 Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              INTEREST PROCESSING STARTS                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ BEGIN TRANS.  │
                    └───────────────┘
                            │
                ┌───────────┴──────────┐
                │                      │
                ▼                      ▼
        ┌──────────────┐      ┌──────────────┐
        │ Process      │      │ Error?       │
        │ Account 1    │──────>│              │
        └──────────────┘      └──────────────┘
                │                      │
                │ ✅ Success          │ ❌ Error
                │                      │
                ▼                      ▼
        ┌──────────────┐      ┌──────────────┐
        │ Process      │      │ • Log error  │
        │ Account 2    │      │ • Mark failed│
        └──────────────┘      │ • Continue   │
                │              └──────────────┘
                │ ✅ Success
                ▼
        ┌──────────────┐
        │ All done     │
        └──────────────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
  ┌─────────┐    ┌──────────┐
  │ COMMIT  │    │ Critical │
  │         │    │ Error?   │
  └─────────┘    └──────────┘
                      │
                      ▼
                ┌──────────┐
                │ ROLLBACK │
                │ Log ❌   │
                │ Return   │
                └──────────┘
```

## 🔄 Scheduler Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER STARTS                                │
│                    npm start                                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  app.listen(PORT, async () => {                                 │
│    • Initialize Express                                         │
│    • Connect to database                                        │
│    • Start schedulers                                           │
│  })                                                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  startInterestSchedulers()                                      │
│    ⏰ INTEREST SCHEDULERS INITIALIZED                           │
│    ✅ FD Interest: '0 3 * * *'                                  │
│    ✅ Savings Interest: '30 3 * * *'                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SCHEDULERS RUNNING                             │
│                                                                 │
│  FD Scheduler ──┐    Savings Scheduler ──┐                      │
│                 │                         │                      │
│                 └─ Waits for 3:00 AM     │                      │
│                                           │                      │
│                                  Waits for 3:30 AM ──┘          │
│                                                                 │
│  When time matches:                                             │
│    → Execute processDailyFDInterest()                           │
│    → Execute processDailySavingsInterest()                      │
│    → Return to waiting                                          │
│                                                                 │
│  Runs continuously until server stops                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER STOPS                                 │
│                    Ctrl+C or SIGTERM                            │
│                                                                 │
│  • Schedulers stop                                              │
│  • Database connections close                                   │
│  • Server shuts down gracefully                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

**Legend:**
- 📐 Architecture Diagrams
- 🔄 Process Flows
- 🎛️ Configuration
- 🔍 Logging Logic
- 📊 Database Interaction
- 🎯 Error Handling
- 🔄 Lifecycle Management
