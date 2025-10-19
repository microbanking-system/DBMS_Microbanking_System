# 🔧 Login Issue Resolution Guide

## ✅ **Issue Fixed!**

The `/api/login` route has been added as a convenience alias to `/api/auth/login`.

---

## 🔐 Available Login Routes

Both of these work identically:
1. **`POST /api/login`** ✅ (Convenience alias - newly added)
2. **`POST /api/auth/login`** ✅ (Standard route)

---

## 🧪 Testing Login

### Option 1: Using PowerShell
```powershell
# Test login endpoint
$body = '{"username":"admin","password":"Admin@123"}'
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/login" -Method Post -Body $body -ContentType "application/json"

# View response
$response | ConvertTo-Json -Depth 3

# Save token for future requests
$token = $response.token
Write-Host "Token saved: $token"
```

### Option 2: Using Postman/Thunder Client
1. Method: `POST`
2. URL: `http://localhost:5000/api/login`
3. Headers:
   - `Content-Type: application/json`
4. Body (raw JSON):
   ```json
   {
     "username": "admin",
     "password": "Admin@123"
   }
   ```

---

## ❌ If You Get "Invalid Credentials" Error

This means either:
1. The username doesn't exist in the database
2. The password hash doesn't match

### Solution: Generate and Update Password Hash

#### Step 1: Generate the correct hash
```powershell
cd C:\Users\ASUS\Desktop\MIMS_edit1018\DBMS_Microbanking_System\backend
node generate-password-hash.js
```

This will output:
- The password hash for `Admin@123`
- An SQL UPDATE query to fix the database

#### Step 2: Check existing users in database
Connect to PostgreSQL and run:
```sql
SELECT employee_id, username, role, first_name, last_name 
FROM employee;
```

#### Step 3: Update the admin password
Use the generated hash from Step 1:
```sql
UPDATE employee 
SET password = '<hash_from_step_1>' 
WHERE username = 'admin';
```

#### Step 4: Or insert admin user if it doesn't exist
```sql
-- 1. Insert contact
INSERT INTO Contact (type, contact_no_1, address, email)
VALUES ('employee', '+1234567890', '123 Admin Street', 'admin@microbanking.com')
RETURNING contact_id;

-- 2. Get/Create branch (use branch_id = 1 if Main Branch exists)
-- INSERT INTO Branch (name, contact_id) VALUES ('Main Branch', <contact_id>);

-- 3. Insert admin employee (use actual contact_id and branch_id)
INSERT INTO Employee (
    role, username, password, 
    first_name, last_name, nic, gender, 
    date_of_birth, branch_id, contact_id
)
VALUES (
    'Admin', 
    'admin', 
    '<hash_from_step_1>',  -- Use generated hash
    'System', 
    'Administrator', 
    '123456789V', 
    'Other', 
    '1990-01-01', 
    1,  -- branch_id
    1   -- contact_id (replace with actual)
);
```

---

## 🎯 Quick Test Default Users

The system may have these default users (check your database):

### Admin User
```json
{
  "username": "admin",
  "password": "Admin@123",
  "role": "Admin"
}
```

### Agent User (if created)
```json
{
  "username": "agent",
  "password": "Agent@123",
  "role": "Agent"
}
```

### Manager User (if created)
```json
{
  "username": "manager",
  "password": "Manager@123",
  "role": "Manager"
}
```

---

## 📝 Complete Login Test Script

Save this as `test-login.ps1`:

```powershell
# B-Trust Login Test Script
$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:5000"

Write-Host "`n=== B-Trust Login Test ===" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n1. Testing server health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/health"
    Write-Host "   ✅ Server is running" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Server is not running!" -ForegroundColor Red
    Write-Host "   Please start the server first: cd backend; node index.js" -ForegroundColor Yellow
    exit 1
}

# Test 2: Login with /api/login
Write-Host "`n2. Testing /api/login endpoint..." -ForegroundColor Yellow
$loginBody = @{
    username = "admin"
    password = "Admin@123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host "   ✅ Login successful!" -ForegroundColor Green
    Write-Host "   User: $($response.employee.full_name) ($($response.employee.role))" -ForegroundColor Cyan
    Write-Host "   Token: $($response.token.Substring(0, 50))..." -ForegroundColor Gray
    
    # Save token
    $token = $response.token
    
    # Test 3: Use token to access protected endpoint
    Write-Host "`n3. Testing authenticated request..." -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $customers = Invoke-RestMethod -Uri "$baseUrl/api/agent/customers" -Headers $headers
    Write-Host "   ✅ Authentication working! Found $($customers.customers.Count) customers" -ForegroundColor Green
    
    Write-Host "`n=== All Tests Passed! ===" -ForegroundColor Green
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
    
    Write-Host "   ❌ Login failed (Status: $statusCode)" -ForegroundColor Red
    Write-Host "   Error: $($errorBody.message)" -ForegroundColor Red
    
    if ($errorBody.message -eq "Invalid credentials") {
        Write-Host "`n   📝 Fix: Run password hash generator and update database:" -ForegroundColor Yellow
        Write-Host "   1. cd backend" -ForegroundColor Gray
        Write-Host "   2. node generate-password-hash.js" -ForegroundColor Gray
        Write-Host "   3. Copy the UPDATE query and run it in your database" -ForegroundColor Gray
    }
}
```

Run with: `.\test-login.ps1`

---

## 🔍 Debugging Checklist

- [ ] Server is running (`node index.js` in backend folder)
- [ ] Database is connected (check server logs)
- [ ] Admin user exists in database
- [ ] Password hash matches `Admin@123`
- [ ] Using correct endpoint: `/api/login` or `/api/auth/login`
- [ ] Request has `Content-Type: application/json` header
- [ ] Request body is valid JSON with `username` and `password` fields

---

## 📞 Still Having Issues?

1. Check server logs for error messages
2. Verify PostgreSQL is running
3. Check database connection settings in `.env` file
4. Run the test script above for detailed diagnostics

---

**Last Updated:** October 18, 2025
**Status:** ✅ Route Fixed - Both `/api/login` and `/api/auth/login` working
