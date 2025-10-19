# 🔌 B-Trust Microbanking System - API Endpoints Quick Reference

## 🌐 Base URL
```
http://localhost:5000
```

---

## 🔐 Authentication Endpoints (No Token Required)

### Login
**Both routes work:**
- `POST /api/login` ✅ (Convenience alias)
- `POST /api/auth/login` ✅ (Standard route)

**Request Body:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "employee": {
    "id": 1,
    "username": "admin",
    "full_name": "Admin User",
    "role": "Admin",
    "branch_id": 1,
    "branch_name": "Main Branch"
  }
}
```

**Error Response (401):**
```json
{
  "status": "error",
  "message": "Invalid credentials"
}
```

### PowerShell Test Command:
```powershell
# Test login
$body = '{"username":"admin","password":"Admin@123"}'
$response = Invoke-WebRequest -Uri "http://localhost:5000/api/login" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

---

## 🌍 Public Endpoints (No Token Required)

### 1. Health Check
```
GET /api/health
```

### 2. Get Saving Plans
```
GET /api/public/saving-plans
```

### 3. Get Branches
```
GET /api/public/branches
```

### 4. Get Fixed Deposit Plans
```
GET /api/public/fd-plans
```

### 5. Get About Information
```
GET /api/public/about
```

---

## 🔒 Protected Endpoints (Token Required)

**Authorization Header Required:**
```
Authorization: Bearer <your_jwt_token>
```

### PowerShell Authentication Example:
```powershell
# 1. Login and save token
$loginBody = '{"username":"admin","password":"Admin@123"}'
$loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginResponse.token

# 2. Use token in subsequent requests
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# 3. Make authenticated request
Invoke-RestMethod -Uri "http://localhost:5000/api/agent/customers" -Method Get -Headers $headers
```

---

## 👤 Agent Endpoints (Role: Agent)

### Customers
- `GET /api/agent/customers` - Get all customers
- `GET /api/agent/customers/:id` - Get customer by ID
- `POST /api/agent/customers/register` - Register new customer
- `PUT /api/agent/customers/:id` - Update customer

### Accounts
- `GET /api/agent/accounts` - Get all accounts
- `GET /api/agent/accounts/search/:searchTerm` - Search accounts
- `POST /api/agent/accounts/create` - Create new account
- `PUT /api/agent/accounts/:account_id/change-plan` - Change saving plan
- `DELETE /api/agent/accounts/:account_id` - Deactivate account

### Transactions
- `POST /api/agent/transactions/process` - Process transaction (deposit/withdrawal)
- `GET /api/agent/transactions/recent` - Get recent transactions

### Fixed Deposits
- `POST /api/agent/fixed-deposits/create` - Create fixed deposit
- `GET /api/agent/fixed-deposits/search` - Search fixed deposits
- `DELETE /api/agent/fixed-deposits/:fd_id` - Deactivate fixed deposit

### Performance
- `GET /api/agent/performance` - Get agent performance metrics

---

## 👔 Admin Endpoints (Role: Admin)

### User Management
- `POST /api/admin/register` - Register new employee
- `GET /api/admin/users` - Get all employees
- `DELETE /api/admin/users/:id` - Delete employee

### Branch Management
- `GET /api/admin/branches` - Get all branches
- `POST /api/admin/branches` - Create new branch
- `DELETE /api/admin/branches/:id` - Delete branch

### System Operations
- `POST /api/admin/refresh-views` - Refresh database views

### Reports
- `GET /api/admin/reports/agent-transactions` - Agent transactions report
- `GET /api/admin/reports/account-summaries` - Account summaries report
- `GET /api/admin/reports/active-fds` - Active fixed deposits report
- `GET /api/admin/reports/interest-summary` - Interest summary report

---

## 🏢 Manager Endpoints (Role: Manager)

### Customer Management
- `GET /api/manager/customers/search?query=...` - Search customers in branch

### Team Management
- `GET /api/manager/team` - Get team agents with performance
- `GET /api/manager/team/:agent_id/transactions` - Get agent transactions

### Branch Analytics
- `GET /api/manager/transactions` - Get branch transactions
- `GET /api/manager/accounts` - Get branch accounts

---

## 📝 Common Request Examples

### 1. Register Customer (Agent)
```powershell
$customerData = @{
    nic = "200012345678"
    full_name = "John Doe"
    date_of_birth = "2000-01-15"
    address = "123 Main St, Colombo"
    phone_number = "0771234567"
    email = "john.doe@example.com"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/agent/customers/register" -Method Post -Body $customerData -Headers $headers
```

### 2. Create Account (Agent)
```powershell
$accountData = @{
    customer_id = 1
    saving_plan_id = 1
    initial_deposit = 5000
    account_type = "Individual"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/agent/accounts/create" -Method Post -Body $accountData -Headers $headers
```

### 3. Process Transaction (Agent)
```powershell
$transactionData = @{
    account_id = "ACC000001"
    transaction_type = "Deposit"
    amount = 1000
    description = "Monthly deposit"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/agent/transactions/process" -Method Post -Body $transactionData -Headers $headers
```

### 4. Create Branch (Admin)
```powershell
$branchData = @{
    name = "Kandy Branch"
    address = "456 Peradeniya Rd, Kandy"
    phone_number = "0812234567"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/admin/branches" -Method Post -Body $branchData -Headers $headers
```

---

## 🚨 Common Errors

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Access denied. No token provided."
}
```
**Solution:** Include `Authorization: Bearer <token>` header

### 403 Forbidden
```json
{
  "status": "error",
  "message": "Access denied. Insufficient permissions."
}
```
**Solution:** Login with correct role (Agent/Admin/Manager)

### 404 Not Found
```json
{
  "status": "error",
  "message": "Route /api/xyz not found"
}
```
**Solution:** Check endpoint URL spelling and method (GET/POST/PUT/DELETE)

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Database error message here"
}
```
**Solution:** Check database connection and data validity

---

## 🧪 Quick Test Script

Save this as `test-api.ps1`:

```powershell
# B-Trust API Quick Test Script

$baseUrl = "http://localhost:5000"

Write-Host "`n=== Testing B-Trust Microbanking API ===" -ForegroundColor Cyan

# 1. Health Check
Write-Host "`n1. Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/health"
    Write-Host "✅ Server is healthy: $($health.message)" -ForegroundColor Green
} catch {
    Write-Host "❌ Health check failed" -ForegroundColor Red
    exit
}

# 2. Login
Write-Host "`n2. Testing Login..." -ForegroundColor Yellow
$loginBody = @{
    username = "admin"
    password = "Admin@123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "✅ Login successful as: $($loginResponse.employee.full_name) ($($loginResponse.employee.role))" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed" -ForegroundColor Red
    exit
}

# 3. Setup headers
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# 4. Test Public Endpoints
Write-Host "`n3. Testing Public Endpoints..." -ForegroundColor Yellow
try {
    $branches = Invoke-RestMethod -Uri "$baseUrl/api/public/branches"
    Write-Host "✅ Fetched $($branches.branches.Count) branches" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to fetch branches" -ForegroundColor Red
}

# 5. Test Protected Endpoint
Write-Host "`n4. Testing Protected Endpoint..." -ForegroundColor Yellow
try {
    $customers = Invoke-RestMethod -Uri "$baseUrl/api/agent/customers" -Headers $headers
    Write-Host "✅ Fetched $($customers.customers.Count) customers" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to fetch customers" -ForegroundColor Red
}

Write-Host "`n=== All Tests Complete ===" -ForegroundColor Cyan
```

Run with: `.\test-api.ps1`

---

## 📚 Additional Resources

- **Full Testing Guide:** See `TESTING_GUIDE.md`
- **Postman Collection:** Import `postman-collection.json`
- **Enhancement Guide:** See `ENHANCEMENTS_GUIDE.md`
- **Refactoring Details:** See `REFACTORING_COMPLETE.md`

---

**Last Updated:** October 18, 2025
