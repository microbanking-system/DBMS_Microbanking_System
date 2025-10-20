DBMS Microbanking System

Overview
- Full‑stack university project for a simple micro‑banking system.
- Backend: Node.js/Express + PostgreSQL.
- Frontend: React + TypeScript (Create React App).
- Auth: JWT with role‑based access (Admin, Manager, Agent).
- Schedulers: node-cron jobs for Savings and Fixed Deposit interest.

What’s included
- REST API with endpoints for authentication, public lookups, agent operations (customers, accounts, transactions, fixed deposits), admin operations (users, branches, reports), and manager views.
- Database schema, functions, triggers, and materialized views for transactional safety and reporting under `database/init-postgres.sql`.
- Postman collection for 37 endpoints under `backend/postman-collection.json`.
- Frontend dashboard and flows for login and role‑based features.

Recent changes (security, correctness, DX)
- Enforce JWT secret via env: removed fallback; backend requires JWT_SECRET.
- Client auth hardening: ProtectedRoute checks JWT exp; expired/malformed tokens log out.
- Interest “system actor” is configurable via SYSTEM_ACTOR_EMPLOYEE_ID (default 1) for audit trails.
- DB uniqueness: Unique index on customer.nic added.
- Postman samples fixed: numeric account_id and corrected request bodies for account creation and FD endpoints.
- Frontend axios base URL reads REACT_APP_API_BASE_URL.
 - FD creation accepts boolean or enum string; backend normalizes to DB enum ('True'/'False'). Postman sample uses string.

Architecture
- Backend service in `backend/` and frontend app in `frontend/`.
- PostgreSQL schema and helpers in `database/`.
- Interest schedulers in `backend/schedulers/interestScheduler.js` invoking `backend/services/interest.js`.

Prerequisites
- Node.js 18+ and npm (or yarn)
- PostgreSQL 14+ (local or remote)
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
- SUPPRESS_GENERAL_LOGS=0              # Optional; set 1 to suppress HTTP logs
- INTEREST_CRON_DEBUG=0                # Optional; 1 = run schedulers every minute
- FD_INTEREST_CRON=0 3 * * *           # Optional; defaults used if omitted
- SAVINGS_INTEREST_CRON=30 3 * * *     # Optional; defaults used if omitted
- SYSTEM_ACTOR_EMPLOYEE_ID=1           # Optional; employee id for automated interest credits

Optionally, for the frontend create `frontend/.env`:
- REACT_APP_API_BASE_URL=http://localhost:5000
You can copy `frontend/.env.example` as a starting point.

Database setup
1) Create the database and user (in psql or your client):
	- CREATE DATABASE microbanking;
	- CREATE USER postgres WITH PASSWORD 'yourpassword';    # or use an existing role
2) Load schema and functions:
	- Open `database/init-postgres.sql` and ensure the `\c` line targets your DB (e.g., microbanking). Adjust or connect manually, then run the script to create tables, enums, triggers, and views.
3) Seed an admin:
	- Open `database/insert-admin.sql` and follow the comments to insert contact, branch, and a default admin user (username: admin, password hash included).
4) Seed example saving/FD plans:
	- Use `database/insert-interests.sql` to populate initial interest plans if provided.

Backend: install and run
1) In a terminal, from the repo root:
	- cd backend
	- npm install
2) Ensure `backend/.env` is configured.
3) Start the API server:
	- npm run dev            # with nodemon
	- or npm start           # plain node
4) Health check: GET http://localhost:5000/api/health

Frontend: install and run
1) In a new terminal from the repo root:
	- cd frontend
	- npm install
2) Ensure `frontend/.env` has REACT_APP_API_BASE_URL pointing to the backend.
3) Start the app:
	- npm start
4) Open http://localhost:3000

Using the Postman collection
- Import `backend/postman-collection.json`.
- The “Login - Admin” request stores the token in a collection variable (`admin_token`). Similar for agent/manager.
- base_url defaults to http://localhost:5000 in the collection; change it if needed.
- Account creation now expects these bodies:
  - Single: { "customer_id": 1, "branch_id": 1, "saving_plan_id": 1, "initial_deposit": 5000 }
  - Joint: { "customer_id": 1, "joint_holders": [2], "branch_id": 1, "saving_plan_id": 1, "initial_deposit": 10000 }

- Fixed deposit creation example body:
	{ "customer_id": 1, "account_id": 1, "fd_plan_id": 1, "principal_amount": 50000, "auto_renewal_status": "False" }

Notes and tips
- JWT must be configured (JWT_SECRET). Server refuses to start token operations without it.
- NIC uniqueness is enforced at DB level. If applying to an existing DB with duplicates, resolve those before creating the unique index.
- Interest schedulers:
  - For fast local testing set INTEREST_CRON_DEBUG=1.
  - Production uses 30‑day cycles per-account based on last credited/open date.
- Logging: set SUPPRESS_GENERAL_LOGS=1 to silence HTTP logs from morgan.

Troubleshooting
- DB connection fails: verify DB_HOST/PORT/NAME/USER/PASSWORD in `backend/.env`.
- CORS issues: backend uses cors(); confirm ports and base URLs.
- 401/403 responses: ensure token exists, isn’t expired, and user has required role.
- Postman errors on payloads: verify numeric IDs and payload keys as shown above.


