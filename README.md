DBMS Microbanking System

Overview
- Full‑stack university project for a simple micro‑banking system.
- Backend: Node.js/Express + PostgreSQL.
- Frontend: React + TypeScript (Create React App).
- Auth: JWT with role‑based access (Admin, Manager, Agent).
- Schedulers: node-cron jobs for Savings and Fixed Deposit interest.

What’s included
- REST API with endpoints for authentication, public lookups, agent operations (customers, accounts, transactions, fixed deposits), admin operations (users, branches, reports), and manager views.
- Database schema, functions, triggers under `database/init-postgres.sql`.
- Postman collection under `backend/postman-collection.json`.
- Frontend dashboards for role‑based features.

Recent changes (policy, data integrity, UX)
- Database: NIC/Birth Certificate format enforced at DB level: exactly 12 digits or 9 digits followed by uppercase `V`.
- Database: Employees must be 18+ (trigger validates `date_of_birth`).
- Business rule: Changing a Savings plan from Teen → Adult requires a valid NIC (not a birth certificate number).
- Backend: Exact NIC endpoints added for Agent and Manager UIs (see API overview below).
- Reports: All date‑range reports use inclusive end dates by comparing `DATE(t.time) BETWEEN startDate AND endDate`.
- Frontend: Customer/Account/FD searches changed to exact NIC/BC and/or ID only (no fuzzy name matching in those flows).
 - Employees: Hard delete removed. Admins can now Activate/Deactivate employees. Inactive employees cannot log in. Self‑deactivation is blocked.

Architecture
- Backend service in `backend/` and frontend app in `frontend/`.
- PostgreSQL schema and helpers in `database/`.
- Interest schedulers in `backend/schedulers/interestScheduler.js` invoking `backend/services/interest.js`.

Prerequisites
- Node.js 18+ and npm (or yarn)
- PostgreSQL 14+
- Git

Environment variables
Create a `.env` file in `backend/` with at least:
- PORT=5000
- NODE_ENV=development
- JWT_SECRET=your_long_random_secret   # Required (no fallback)
- DB_HOST=localhost
- DB_PORT=5432
- DB_NAME=microbanking
- DB_USER=postgres
- DB_PASSWORD=yourpassword
 INTEREST_CRON_DEBUG=0                # Optional; 1 = run schedulers every 10 seconds (debug)
 FD_INTEREST_CRON=0 3 * * *           # Optional; defaults used if omitted (supports seconds field)
 SAVINGS_INTEREST_CRON=30 3 * * *     # Optional; defaults used if omitted (supports seconds field)
 Interest schedulers:
 	- For fast local testing set `INTEREST_CRON_DEBUG=1` (runs every 10 seconds in debug mode).
 	- Database demo mapping uses 30 seconds ≈ 1 month between credits; running the cron every 30 seconds gives a clear "once-per-cycle" demo.
 	- You can override schedules via `FD_INTEREST_CRON` and `SAVINGS_INTEREST_CRON` to match 30s cadence.
 	- Production uses 30‑day cycles per-account based on last credited/open date.

 Interest scheduler details (cron)
 - Location: `backend/schedulers/interestScheduler.js` (uses `node-cron`).
 - Defaults if no env vars set and not in debug:
 	- FD interest: `0 3 * * *` (every day at 03:00)
 	- Savings interest: `30 3 * * *` (every day at 03:30)
 - Debug mode for demos/tests:
 	- Set `INTEREST_CRON_DEBUG=1` to run both FD & Savings every 10 seconds.
 	- Under the hood it uses a 6‑field cron with seconds: `*/10 * * * * *`.
 	- Note: The DB testing logic credits at most once every 30 seconds per account/FD; you may prefer a 30‑second cron for a 1:1 demo cadence.
 - Custom schedules via env vars (seconds supported with 6‑field format):
 	- `FD_INTEREST_CRON` and `SAVINGS_INTEREST_CRON` accept expressions like:
 		- Every 10 seconds: `*/10 * * * * *`
 		- Every 30 seconds: `*/30 * * * * *`
 		- Daily at 03:00: `0 3 * * *`
 		- Daily at 03:30: `30 3 * * *`
 - Examples (Linux/bash):
 	- Run backend in debug (10s cadence for both):
 		- `export INTEREST_CRON_DEBUG=1 && npm run dev --prefix backend`
 	- Override without debug (10s cadence):
 		- `export FD_INTEREST_CRON="*/10 * * * * *" && export SAVINGS_INTEREST_CRON="*/10 * * * * *" && npm run dev --prefix backend`
 	- Override without debug (30s cadence to match DB demo window):
 		- `export FD_INTEREST_CRON="*/30 * * * * *" && export SAVINGS_INTEREST_CRON="*/30 * * * * *" && npm run dev --prefix backend`

 Database demo window
 - In `database/init-postgres.sql`, testing logic sets credit eligibility to once every 30 seconds (per account/FD):
   - `calculate_fd_interest_due` and `calculate_savings_interest_due` use `INTERVAL '30 seconds'` in demo mode.
 - For production, switch to the 30‑day interval by uncommenting the 30‑day lines and commenting out the testing lines as indicated in the SQL file.
- REACT_APP_API_BASE_URL=http://localhost:5000

Quick start (local)
1) Backend install & run
	 - `cd backend && npm install`
	 - Configure `backend/.env`
	 - Run: `npm run dev` (nodemon) or `npm start`
	 - Health: GET http://localhost:5000/api/health
2) Frontend install & run
	 - `cd frontend && npm install`
	 - Ensure `REACT_APP_API_BASE_URL` points to backend
	 - Run: `npm start` (http://localhost:3000)

Database setup & reset
- From repo root:
	1. Drop and re-create database (adjust `-U`/password for your environment):
		 - `dropdb --if-exists -U postgres -h localhost microbanking`
		 - `createdb -U postgres -h localhost microbanking`
	2. Initialize schema:
		 - `psql -U postgres -h localhost -d microbanking -f database/init-postgres.sql`
	3. Seed saving and FD plans:
		 - `psql -U postgres -h localhost -d microbanking -f database/insert-interests.sql`
	4. Seed admin user (default username: `admin`):
		 - `psql -U postgres -h localhost -d microbanking -f database/insert-admin.sql`
	5. Optional: generate a password hash for admin with `node backend/generate-admin-hash.js`

Database rules and constraints (important)
- Employee NIC must match one of:
	- 12 digits: `^[0-9]{12}$`
	- 9 digits + uppercase V: `^[0-9]{9}V$`
- Customer NIC/Birth Certificate number must match the same rules as above.
- Unique NIC for customers: unique index on `customer.nic`.
- Employees must be 18+ (trigger on insert/update of `date_of_birth`).
- Savings plan change Teen → Adult requires a valid NIC; DB function enforces this and will reject invalid transitions.

API overview (selected)
- Auth: `/api/auth/login`
- Admin:
	- Users/Branches CRUD
		- Users: `GET /api/admin/users`, `POST /api/admin/register`, `PATCH /api/admin/users/:id/status` (body: `{ "status": "Active" | "Inactive" }`), `DELETE /api/admin/users/:id` (alias for deactivation)
	- Reports (all inclusive date range):
		- `/api/admin/reports/agent-transactions?startDate&endDate`
		- `/api/admin/reports/account-summaries?startDate&endDate`
		- `/api/admin/reports/active-fds`
		- `/api/admin/reports/interest-summary?month&year`
		- `/api/admin/reports/customer-activity?startDate&endDate`
- Agent:
	- Customers: `/api/agent/customers/by-nic/:nic` (exact NIC/BC), `/api/agent/customers/:id`
	- Accounts: `/api/agent/accounts/by-nic/:nic` (exact NIC/BC), `/api/agent/accounts/:id/details`
	- FDs: `/api/agent/fixed-deposits/by-nic/:nic` (exact NIC/BC)
	- Transactions: `/api/agent/transactions/process`
- Manager:
	- Customers by exact NIC in branch: `/api/manager/customers/by-nic/:nic`
	- Branch accounts/transactions/team: `/api/manager/accounts`, `/api/manager/transactions`, `/api/manager/team/agents`

Frontend behavior (search and validations)
- Customer/Account/FD selections/searches are restricted to exact NIC/Birth Certificate numbers and/or exact IDs:
	- 12‑digit numbers are treated as NIC/BC (not account IDs).
	- 9 digits + `V` (uppercase) also treated as NIC.
	- Account/FD searches accept exact numeric IDs where applicable.
- Teen → Adult plan changes require NIC to be present on the customer record; the UI blocks invalid transitions and the backend rejects them.

Using the Postman collection
- Import `backend/postman-collection.json`.
- The “Login - Admin” request stores a token in a collection variable. Similar flows for agent/manager.
- `base_url` defaults to http://localhost:5000; change if needed.
- Account creation examples:
	- Single: `{ "customer_id": 1, "branch_id": 1, "saving_plan_id": 1, "initial_deposit": 5000 }`
	- Joint: `{ "customer_id": 1, "joint_holders": [2], "branch_id": 1, "saving_plan_id": 1, "initial_deposit": 10000 }`
- FD creation example:
	- `{ "customer_id": 1, "account_id": 1, "fd_plan_id": 1, "principal_amount": 50000, "auto_renewal_status": "False" }`

Notes and tips
- JWT must be configured (JWT_SECRET). Server refuses to start token operations without it.
- Interest schedulers:
	- For fast local testing set `INTEREST_CRON_DEBUG=1`.
	- Production uses 30‑day cycles per-account based on last credited/open date.
- Logging: set `SUPPRESS_GENERAL_LOGS=1` to silence HTTP logs from morgan.

Troubleshooting
- DB connection fails: verify DB_HOST/PORT/NAME/USER/PASSWORD in `backend/.env`.
- CORS issues: backend uses `cors()`; confirm ports and base URLs.
- 401/403 responses: ensure token exists, isn’t expired, and user has required role.
- Reports appear empty: ensure the date range covers activity; reports use inclusive end dates by `DATE(t.time)` filtering.
- Customer NIC errors: NIC/BC must be 12 digits or 9 digits + uppercase `V`.


