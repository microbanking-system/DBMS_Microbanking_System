Microbancking System.

## Getting started

Follow these steps after cloning the repository to run the project locally. The repository intentionally ignores generated build artifacts (`frontend/build/`, `backend/build/`) and secret environment files (e.g. `backend/.env`) so you must build and configure those locally.

1. Clone the repo

```
git clone <repo-url>
cd DBMS_Microbanking_System
```

2. Database (PostgreSQL)

```
# Drop or create database (you will be prompted for the postgres password)
dropdb --if-exists -U postgres -h localhost newdb
createdb -U postgres -h localhost newdb

# Initialize schema
psql -U postgres -h localhost -d newdb -f database/init-postgres.sql

# Seed saving plans and FD plans
psql -U postgres -h localhost -d newdb -f database/insert-interests.sql

# Seed admin user
psql -U postgres -h localhost -d newdb -f database/insert-admin.sql
```

3. Backend

```
cd backend
npm install
# Create a 'backend/.env' file (not committed). You can copy the example provided:
cp .env.example .env
# Edit .env with your DB connection, JWT secret and other values, then run:
npm run dev    # development (nodemon)
# or
npm start      # production
```

4. Frontend

For development (hot reload):

```
cd frontend
npm install
npm start
```

For a production build (creates `frontend/build/` locally):

```
cd frontend
npm run build
# serve from a static server, or optionally configure the backend to serve files from frontend/build
```

Notes
- `frontend/build/` and `backend/build/` are intentionally ignored by git. This is normal — these are generated artifacts. When you clone the repo you must run the build steps above to create them locally if you want to serve prebuilt files.
- `backend/.env` is ignored and must be created locally. Use `backend/.env.example` as a template.
- The backend exposes API routes under `/api`. If you want the backend to serve the frontend build, add a small express.static route pointing to `frontend/build` and ensure you build the frontend before deployment.

If you want, I can add a small npm script at the repository root to bootstrap both services (install + build + start) or add a `docker-compose.yml` to simplify setup.

---

## Quick reference / local demo notes

- Admin default credentials used in the repository examples:
	- Username: `admin`
	- Password: `admin123`

- To generate a proper bcrypt hash for the admin password (run from the repo root):

```
cd backend
node generate-admin-hash.js
# This will print a bcrypt hash you can insert into the DB or use in `insert-admin.sql` if needed.
```

- Example Postgres local connection used in development (adjust as needed):
	- Host: `localhost`
	- User: `postgres`
	- Password: `123` (example from Info.txt — change on your machine)

### Interest scheduler demo

The backend includes scheduled jobs to credit interests. By default they run once per day. To demo interest processing faster (minute-by-minute) do the following:

1. Pick an account and (for demonstration) set its open_date back 31 days so interest will be eligible:

```sql
-- replace <account_id> with the real id
UPDATE account SET open_date = CURRENT_DATE - INTERVAL '31 days' WHERE account_id = <account_id>;
-- for fixed deposits (if applicable):
UPDATE fixeddeposit SET open_date = CURRENT_DATE - INTERVAL '31 days' WHERE fd_id = <fd_id>;
```

2. In `backend/.env`, set:

```
INTEREST_CRON_DEBUG=1
```

3. Restart the backend (so schedulers pick up the new env). With `INTEREST_CRON_DEBUG=1` the jobs run every minute which is convenient for demos.

---
