# Microbanking Backend (Modularized)

This backend has been refactored from a single monolithic `index.js` into a standard Express modular structure with separated routers, middleware, services, and a scheduler.

## Structure

- `index.js` — Entry point that boots the server and starts schedulers
- `src/app.js` — Express app setup and router mounting
- `src/db.js` — Shared PostgreSQL Pool using environment variables
- `src/middleware/auth.js` — JWT auth and role-based access
- `src/routes/` — Feature routers
  - `public.js` — Open endpoints (health, plans, branches)
  - `auth.js` — Login endpoint
  - `admin.js` — Admin-only management and reports
  - `agent.js` — Agent/Admin operations (transactions, accounts, FDs, customers)
  - `manager.js` — Manager/Admin oversight endpoints
- `src/services/interest.js` — FD/Savings interest processing using DB functions
- `src/scheduler/interestScheduler.js` — Cron jobs for interest processing

## Run

- Install deps (from repo root or backend folder):
  - npm install --prefix backend
- Start dev (auto-reload):
  - npm run dev --prefix backend
- Start production:
  - npm start --prefix backend

Server listens on `PORT` (default 5000).

## Environment

Create a `.env` file in `backend/` (see `.env.example`):

- PORT=5000
- DB_HOST=localhost
- DB_PORT=5432
- DB_USER=postgres
- DB_PASSWORD=yourpassword
- DB_NAME=newdb
- JWT_SECRET=changeme
- FD_INTEREST_CRON=0 3 * * *
- SAVINGS_INTEREST_CRON=30 3 * * *
- INTEREST_CRON_DEBUG=0  # set to 1 to run every minute for testing

If `INTEREST_CRON_DEBUG=1`, both FD and Savings interest processors run every minute. Otherwise, they default to the given CRON expressions.

## Notes

- All original endpoints are preserved under the same paths, now organized by role and feature.
- Database business logic stays centralized in SQL functions (e.g., `create_transaction_with_validation`, interest calculators). This keeps behavior consistent.
- Health check: `GET /api/health` verifies DB connectivity.
