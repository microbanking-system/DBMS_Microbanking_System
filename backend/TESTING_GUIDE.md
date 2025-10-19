# 🧪 API Testing Guide - B-Trust Microbanking System

## ⚠️ **PRIORITY: Interest Scheduler Testing**

### ✅ Quick Fix Applied

**Database import path corrected in `services/interest.js`** - The schedulers are now ready to test!

### 🚀 Testing Steps

#### 1. Restart Backend Server

**Stop current server:**
- Press `Ctrl+C` in terminal, OR
- PowerShell: `Stop-Process -Name node -Force`

**Start fresh:**
```powershell
cd backend
npm start
```

#### 2. Watch Console Output (Runs Every Minute in Debug Mode)

**Expected every 60 seconds:**
```
🚀 Starting daily FD interest processing...
💰 Credited LKR 1250.00 interest for FD 1 to account 101
✅ Daily FD interest processing completed!
📊 FDs Processed: 1
💰 Total Interest Credited: LKR 1,250.00
```

#### 3. Database Verification

```sql
-- Recent interest transactions
SELECT * FROM Transactions 
WHERE transaction_type = 'Interest' 
ORDER BY time DESC LIMIT 10;

-- FD interest calculations
SELECT * FROM fd_interest_calculations 
ORDER BY credited_at DESC LIMIT 10;

-- Savings interest calculations
SELECT * FROM savings_interest_calculations 
ORDER BY credited_at DESC LIMIT 10;
```

#### 4. Switch to Production Mode (After Testing)

Update `.env`:
```env
INTEREST_CRON_DEBUG=0  # Change from 1 to 0
```
Restart server. Processing will run at 3:00 AM and 3:30 AM daily.

---

## 📋 Pre-Testing Setup

### ✅ Server Status
- Server URL: `http://localhost:5000`
- Health Check: `GET http://localhost:5000/api/health`

### 🔑 Authentication Flow
1. First login to get JWT token: `POST /api/auth/login`
2. Use the token in Authorization header for protected routes
3. Different roles have different access levels: Agent, Manager, Admin

---

## 🧪 Testing Scenarios by Module

### 1️⃣ **Health Check** (No Auth Required)

```http
GET http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "B-Trust Microbanking System API is running",
  "timestamp": "2025-10-18T15:08:15.568Z"
}
```

---

### 2️⃣ **Authentication Module**

#### Test 1: Login with Admin
```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin@123"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "employee": {
    "employee_id": 1,
    "username": "admin",
    "role": "Admin",
    "first_name": "System",
    "last_name": "Administrator"
  }
}
```

**Save the token** for subsequent requests!

#### Test 2: Login with Invalid Credentials
```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "wrongpassword"
}
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "Invalid credentials"
}
```

---

### 3️⃣ **Public Module** (No Auth Required)

#### Test 3: Get Saving Plans
```http
GET http://localhost:5000/api/public/saving-plans
```

**Expected Response:**
```json
{
  "status": "success",
  "savingPlans": [
    {
      "saving_plan_id": 1,
      "plan_type": "Adult",
      "interest": "10.00",
      "min_balance": "1000.00"
    },
    ...
  ]
}
```

#### Test 4: Get Branches
```http
GET http://localhost:5000/api/public/branches
```

#### Test 5: Get FD Plans
```http
GET http://localhost:5000/api/public/fd-plans
```

#### Test 6: Get Bank Info
```http
GET http://localhost:5000/api/public/about
```

---

### 4️⃣ **Agent Module** (Requires Agent or Admin JWT)

**Note:** Add this header to all Agent requests:
```
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

#### Test 7: Get Agent Performance
```http
GET http://localhost:5000/api/agent/performance
Authorization: Bearer YOUR_AGENT_TOKEN
```

#### Test 8: Get All Customers
```http
GET http://localhost:5000/api/agent/customers
Authorization: Bearer YOUR_AGENT_TOKEN
```

#### Test 9: Register New Customer
```http
POST http://localhost:5000/api/agent/customers/register
Authorization: Bearer YOUR_AGENT_TOKEN
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "nic": "123456789V",
  "gender": "Male",
  "date_of_birth": "1990-01-15",
  "contact_no_1": "0771234567",
  "contact_no_2": "0112345678",
  "address": "123 Main St, Colombo",
  "email": "john.doe@example.com"
}
```

#### Test 10: Get Customer by ID
```http
GET http://localhost:5000/api/agent/customers/1
Authorization: Bearer YOUR_AGENT_TOKEN
```

#### Test 11: Update Customer
```http
PUT http://localhost:5000/api/agent/customers/1
Authorization: Bearer YOUR_AGENT_TOKEN
Content-Type: application/json

{
  "contact_no_1": "0779999999",
  "email": "john.updated@example.com",
  "address": "456 New Address, Colombo"
}
```

#### Test 12: Create Account
```http
POST http://localhost:5000/api/agent/accounts/create
Authorization: Bearer YOUR_AGENT_TOKEN
Content-Type: application/json

{
  "customer_ids": [1],
  "branch_id": 1,
  "saving_plan_id": 1,
  "initial_deposit": 5000,
  "account_type": "single"
}
```

**For Joint Account:**
```json
{
  "customer_ids": [1, 2],
  "branch_id": 1,
  "saving_plan_id": 1,
  "initial_deposit": 10000,
  "account_type": "joint"
}
```

#### Test 13: Get Active Accounts
```http
GET http://localhost:5000/api/agent/accounts
Authorization: Bearer YOUR_AGENT_TOKEN
```

#### Test 14: Process Transaction - Deposit
```http
POST http://localhost:5000/api/agent/transactions/process
Authorization: Bearer YOUR_AGENT_TOKEN
Content-Type: application/json

{
  "account_id": "ACC001",
  "transaction_type": "Deposit",
  "amount": 5000,
  "description": "Cash deposit"
}
```

#### Test 15: Process Transaction - Withdrawal
```http
POST http://localhost:5000/api/agent/transactions/process
Authorization: Bearer YOUR_AGENT_TOKEN
Content-Type: application/json

{
  "account_id": "ACC001",
  "transaction_type": "Withdrawal",
  "amount": 2000,
  "description": "Cash withdrawal"
}
```

#### Test 16: Get Recent Transactions
```http
GET http://localhost:5000/api/agent/transactions/recent
Authorization: Bearer YOUR_AGENT_TOKEN
```

#### Test 17: Create Fixed Deposit
```http
POST http://localhost:5000/api/agent/fixed-deposits/create
Authorization: Bearer YOUR_AGENT_TOKEN
Content-Type: application/json

{
  "customer_id": 1,
  "account_id": "ACC001",
  "fd_plan_id": 1,
  "principal_amount": 50000,
  "auto_renewal_status": true
}
```

#### Test 18: Search Fixed Deposits
```http
GET http://localhost:5000/api/agent/fixed-deposits/search?query=123456789V
Authorization: Bearer YOUR_AGENT_TOKEN
```

#### Test 19: Deactivate Fixed Deposit
```http
POST http://localhost:5000/api/agent/fixed-deposits/deactivate
Authorization: Bearer YOUR_AGENT_TOKEN
Content-Type: application/json

{
  "fd_id": 1
}
```

#### Test 20: Search Accounts
```http
GET http://localhost:5000/api/agent/accounts/search/John
Authorization: Bearer YOUR_AGENT_TOKEN
```

#### Test 21: Change Account Plan
```http
POST http://localhost:5000/api/agent/accounts/change-plan
Authorization: Bearer YOUR_AGENT_TOKEN
Content-Type: application/json

{
  "account_id": "ACC001",
  "new_saving_plan_id": 2,
  "reason": "Customer requested plan upgrade"
}
```

#### Test 22: Deactivate Account
```http
POST http://localhost:5000/api/agent/accounts/deactivate
Authorization: Bearer YOUR_AGENT_TOKEN
Content-Type: application/json

{
  "account_id": "ACC001",
  "reason": "Customer closing account"
}
```

---

### 5️⃣ **Admin Module** (Requires Admin JWT)

**Note:** Add this header to all Admin requests:
```
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Test 23: Register New Employee
```http
POST http://localhost:5000/api/admin/register
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "role": "Agent",
  "username": "agent001",
  "password": "Agent@123",
  "first_name": "Jane",
  "last_name": "Smith",
  "nic": "987654321V",
  "gender": "Female",
  "date_of_birth": "1995-05-20",
  "branch_id": 1,
  "contact_no_1": "0771111111",
  "address": "789 Employee St, Colombo",
  "email": "jane.smith@btrust.lk"
}
```

#### Test 24: Get All Users
```http
GET http://localhost:5000/api/admin/users
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Test 25: Delete User
```http
DELETE http://localhost:5000/api/admin/users/5
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Test 26: Get All Branches
```http
GET http://localhost:5000/api/admin/branches
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Test 27: Create Branch
```http
POST http://localhost:5000/api/admin/branches
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "branch_id": "BR005",
  "name": "Galle Branch",
  "contact_no_1": "0912222222",
  "address": "45 Galle Road, Galle",
  "email": "galle@btrust.lk"
}
```

#### Test 28: Delete Branch
```http
DELETE http://localhost:5000/api/admin/branches/5
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Test 29: Refresh Materialized Views
```http
POST http://localhost:5000/api/admin/refresh-views
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Test 30: Get Agent Transactions Report
```http
GET http://localhost:5000/api/admin/reports/agent-transactions?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Test 31: Get Account Summaries Report
```http
GET http://localhost:5000/api/admin/reports/account-summaries?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Test 32: Get Active FDs Report
```http
GET http://localhost:5000/api/admin/reports/active-fds
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Test 33: Get Interest Summary Report
```http
GET http://localhost:5000/api/admin/reports/interest-summary?month=10&year=2024
Authorization: Bearer YOUR_ADMIN_TOKEN
```

---

### 6️⃣ **Manager Module** (Requires Manager or Admin JWT)

**Note:** Add this header to all Manager requests:
```
Authorization: Bearer YOUR_MANAGER_TOKEN
```

#### Test 34: Search Customers in Branch
```http
GET http://localhost:5000/api/manager/customers/search?query=John
Authorization: Bearer YOUR_MANAGER_TOKEN
```

#### Test 35: Get Team Agents
```http
GET http://localhost:5000/api/manager/team/agents
Authorization: Bearer YOUR_MANAGER_TOKEN
```

#### Test 36: Get Agent Transactions
```http
GET http://localhost:5000/api/manager/team/agents/2/transactions
Authorization: Bearer YOUR_MANAGER_TOKEN
```

#### Test 37: Get Branch Transactions
```http
GET http://localhost:5000/api/manager/transactions?start=2024-01-01&end=2024-12-31
Authorization: Bearer YOUR_MANAGER_TOKEN
```

#### Test 38: Get Branch Accounts
```http
GET http://localhost:5000/api/manager/accounts
Authorization: Bearer YOUR_MANAGER_TOKEN
```

---

## 🔒 Authorization Testing

### Test Unauthorized Access
Try accessing protected endpoints without token:
```http
GET http://localhost:5000/api/agent/customers
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "Authorization required"
}
```

### Test Role-Based Access
Try accessing Admin endpoint with Agent token:
```http
GET http://localhost:5000/api/admin/users
Authorization: Bearer AGENT_TOKEN_HERE
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "Admin access required"
}
```

---

## 📊 Testing Checklist

### ✅ Module Testing Progress

- [ ] **Health Check** - Server status
- [ ] **Auth Module** (2 tests)
  - [ ] Valid login
  - [ ] Invalid login
- [ ] **Public Module** (4 tests)
  - [ ] Get saving plans
  - [ ] Get branches
  - [ ] Get FD plans
  - [ ] Get bank info
- [ ] **Agent Module** (16 tests)
  - [ ] Performance metrics
  - [ ] Customer CRUD operations
  - [ ] Account management
  - [ ] Transaction processing
  - [ ] Fixed deposit operations
- [ ] **Admin Module** (11 tests)
  - [ ] User management
  - [ ] Branch management
  - [ ] System operations
  - [ ] Reports
- [ ] **Manager Module** (5 tests)
  - [ ] Customer search
  - [ ] Team management
  - [ ] Branch analytics

### ✅ Security Testing
- [ ] Test without authorization token
- [ ] Test with expired token
- [ ] Test with wrong role (Agent accessing Admin endpoints)
- [ ] Test SQL injection attempts
- [ ] Test invalid input validation

---

## 🛠️ Tools for Testing

### Option 1: Thunder Client (VS Code Extension)
1. Install Thunder Client extension in VS Code
2. Import the collection (see postman-collection.json)
3. Set up environment variables for tokens
4. Run tests sequentially

### Option 2: Postman
1. Download Postman from https://www.postman.com/
2. Import the collection file
3. Set up environment with base_url and tokens
4. Use Collection Runner for automated testing

### Option 3: cURL (Command Line)
```bash
# Health Check
curl http://localhost:5000/api/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'

# Protected Endpoint
curl http://localhost:5000/api/agent/customers \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Authorization required"
**Solution:** Make sure you include the Authorization header with Bearer token

### Issue 2: "Invalid or expired token"
**Solution:** Login again to get a fresh token

### Issue 3: "Role access required"
**Solution:** Use the correct token for the endpoint (Admin token for admin routes)

### Issue 4: "Database error"
**Solution:** Check if PostgreSQL is running and database connection is established

### Issue 5: Port already in use
**Solution:** Stop existing node process or change port in .env file

---

## 📝 Test Results Template

```markdown
## Test Results - [Date]

### Summary
- Total Tests: 38
- Passed: __
- Failed: __
- Success Rate: __%

### Failed Tests
1. Test Name: ________
   - Error: ________
   - Fix Applied: ________

### Performance Notes
- Average Response Time: __ ms
- Slowest Endpoint: ________
- Database Query Issues: ________
```

---

**Happy Testing! 🚀**
