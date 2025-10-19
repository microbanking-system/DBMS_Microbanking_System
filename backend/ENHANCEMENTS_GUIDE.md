# 🚀 Optional Enhancements Guide

## Overview
This document provides guidance on implementing optional enhancements to improve the B-Trust Microbanking System API.

---

## 1️⃣ Input Validation Middleware ✅ **CREATED**

### Status: Implementation Ready

**File Created:** `middleware/validation.js`

### Features Implemented:
- ✅ Express-validator integration
- ✅ Comprehensive validation rules for all modules
- ✅ Custom validation logic for complex scenarios
- ✅ Standardized error response format

### How to Use:

#### Step 1: Install express-validator
```bash
npm install express-validator
```

#### Step 2: Import validators in routes
```javascript
// In routes/auth.js
const { validateLogin } = require('../middleware/validation');

router.post('/login', validateLogin, authController.login);
```

#### Step 3: Apply to all routes
Update each route file to include appropriate validators:

**Auth Routes:**
```javascript
const { validateLogin } = require('../middleware/validation');
router.post('/login', validateLogin, authController.login);
```

**Agent Routes:**
```javascript
const {
  validateCustomerRegistration,
  validateCustomerUpdate,
  validateAccountCreation,
  validateTransaction,
  validateFDCreation,
  validateSearchTerm,
  validateId
} = require('../middleware/validation');

router.post('/customers/register', validateCustomerRegistration, agentController.registerCustomer);
router.put('/customers/:id', validateCustomerUpdate, agentController.updateCustomer);
router.post('/accounts/create', validateAccountCreation, agentController.createAccount);
router.post('/transactions/process', validateTransaction, agentController.processTransaction);
router.post('/fixed-deposits/create', validateFDCreation, agentController.createFixedDeposit);
router.get('/accounts/search/:searchTerm', validateSearchTerm, agentController.searchAccounts);
router.get('/customers/:id', validateId, agentController.getCustomerById);
```

**Admin Routes:**
```javascript
const {
  validateEmployeeRegistration,
  validateBranchCreation,
  validateDateRange,
  validateMonthYear,
  validateId
} = require('../middleware/validation');

router.post('/register', validateEmployeeRegistration, adminController.registerEmployee);
router.post('/branches', validateBranchCreation, adminController.createBranch);
router.delete('/users/:id', validateId, adminController.deleteUser);
router.get('/reports/agent-transactions', validateDateRange, adminController.getAgentTransactionsReport);
router.get('/reports/interest-summary', validateMonthYear, adminController.getInterestSummaryReport);
```

**Manager Routes:**
```javascript
const { validateSearchQuery, validateDateRange } = require('../middleware/validation');

router.get('/customers/search', validateSearchQuery, managerController.searchCustomers);
router.get('/transactions', validateDateRange, managerController.getBranchTransactions);
```

### Benefits:
- ✅ Prevent invalid data from reaching controllers
- ✅ Consistent error messages
- ✅ Improved security (prevent SQL injection, XSS)
- ✅ Better user experience with clear validation errors
- ✅ Reduced database load (invalid requests rejected early)

---

## 2️⃣ API Documentation with Swagger

### Status: Not Implemented

### Implementation Steps:

#### Step 1: Install Dependencies
```bash
npm install swagger-jsdoc swagger-ui-express
```

#### Step 2: Create Swagger Configuration
**File:** `config/swagger.js`

```javascript
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'B-Trust Microbanking System API',
      version: '1.0.0',
      description: 'Complete API documentation for B-Trust Microbanking System',
      contact: {
        name: 'B-Trust Support',
        email: 'support@btrust.lk'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://api.btrust.lk',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./routes/*.js', './controllers/*.js']
};

module.exports = swaggerJsdoc(options);
```

#### Step 3: Add to index.js
```javascript
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Add after route mounting
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

console.log('📚 API Documentation available at: http://localhost:5000/api-docs');
```

#### Step 4: Add JSDoc Comments
Example for a route:

```javascript
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 example: Admin@123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 token:
 *                   type: string
 *                 employee:
 *                   type: object
 */
router.post('/login', authController.login);
```

### Benefits:
- 📚 Interactive API documentation
- 🧪 Built-in API testing interface
- 📖 Auto-generated from code comments
- 🔄 Always up-to-date with code
- 👥 Better developer experience

---

## 3️⃣ Unit Testing with Jest

### Status: Not Implemented

### Implementation Steps:

#### Step 1: Install Dependencies
```bash
npm install --save-dev jest supertest
```

#### Step 2: Update package.json
```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "jest": {
    "testEnvironment": "node",
    "coveragePathIgnorePatterns": ["/node_modules/"]
  }
}
```

#### Step 3: Create Test Files
**File:** `tests/auth.test.js`

```javascript
const request = require('supertest');
const app = require('../index');

describe('Authentication API', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'Admin@123'
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.status).toBe('success');
    });

    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword'
        });
      
      expect(res.statusCode).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin'
        });
      
      expect(res.statusCode).toBe(400);
    });
  });
});
```

**File:** `tests/agent.test.js`

```javascript
const request = require('supertest');
const app = require('../index');

describe('Agent API', () => {
  let token;

  beforeAll(async () => {
    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'agent', password: 'Agent@123' });
    token = loginRes.body.token;
  });

  describe('GET /api/agent/customers', () => {
    it('should get customers with valid token', async () => {
      const res = await request(app)
        .get('/api/agent/customers')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('customers');
    });

    it('should reject without token', async () => {
      const res = await request(app)
        .get('/api/agent/customers');
      
      expect(res.statusCode).toBe(401);
    });
  });
});
```

#### Step 4: Run Tests
```bash
npm test
```

### Test Coverage Goals:
- ✅ Unit tests for all controllers
- ✅ Integration tests for API endpoints
- ✅ Authentication/Authorization tests
- ✅ Error handling tests
- ✅ Database transaction tests
- 🎯 Target: 80%+ code coverage

---

## 4️⃣ Caching with Redis

### Status: Not Implemented

### Implementation Steps:

#### Step 1: Install Redis and Client
```bash
# Install Redis on Windows (using Chocolatey)
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases

# Install Node.js Redis client
npm install redis
```

#### Step 2: Create Redis Configuration
**File:** `config/redis.js`

```javascript
const redis = require('redis');

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

module.exports = redisClient;
```

#### Step 3: Create Cache Middleware
**File:** `middleware/cache.js`

```javascript
const redisClient = require('../config/redis');

/**
 * Cache middleware for GET requests
 * @param {number} duration - Cache duration in seconds
 */
const cache = (duration = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cachedData = await redisClient.get(key);
      
      if (cachedData) {
        console.log(`📦 Cache HIT: ${key}`);
        return res.json(JSON.parse(cachedData));
      }

      console.log(`🔍 Cache MISS: ${key}`);
      
      // Store original send function
      const originalSend = res.json;
      
      // Override send function to cache response
      res.json = function(data) {
        res.json = originalSend;
        
        // Cache the response
        redisClient.setex(key, duration, JSON.stringify(data));
        
        return res.json(data);
      };

      next();
    } catch (error) {
      console.error('Cache error:', error);
      next();
    }
  };
};

module.exports = { cache };
```

#### Step 4: Apply Caching to Routes
```javascript
const { cache } = require('../middleware/cache');

// Cache public data for 5 minutes (300 seconds)
router.get('/saving-plans', cache(300), publicController.getSavingPlans);
router.get('/branches', cache(300), publicController.getBranches);
router.get('/fd-plans', cache(300), publicController.getFDPlans);

// Cache reports for 1 hour (3600 seconds)
router.get('/reports/active-fds', cache(3600), adminController.getActiveFDsReport);

// Don't cache frequently changing data
router.get('/transactions/recent', agentController.getRecentTransactions);
```

#### Step 5: Cache Invalidation
**File:** `utils/cacheInvalidation.js`

```javascript
const redisClient = require('../config/redis');

/**
 * Clear cache by pattern
 */
const clearCachePattern = async (pattern) => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`🗑️ Cleared ${keys.length} cache keys matching: ${pattern}`);
    }
  } catch (error) {
    console.error('Cache clear error:', error);
  }
};

/**
 * Clear specific cache key
 */
const clearCache = async (key) => {
  try {
    await redisClient.del(key);
    console.log(`🗑️ Cleared cache: ${key}`);
  } catch (error) {
    console.error('Cache clear error:', error);
  }
};

module.exports = { clearCachePattern, clearCache };
```

#### Step 6: Invalidate Cache on Updates
```javascript
const { clearCachePattern } = require('../utils/cacheInvalidation');

// In controller after creating/updating data
exports.createBranch = async (req, res) => {
  // ... create branch logic ...
  
  // Clear branches cache
  await clearCachePattern('cache:/api/public/branches*');
  await clearCachePattern('cache:/api/admin/branches*');
  
  res.json({ status: 'success', message: 'Branch created' });
};
```

### Caching Strategy:
- ✅ **Static data**: Cache for 5-10 minutes (saving plans, branches, FD plans)
- ✅ **Reports**: Cache for 1 hour (aggregate reports, summaries)
- ✅ **User-specific data**: Cache for 1-2 minutes (performance metrics)
- ❌ **Real-time data**: Don't cache (recent transactions, account balances)
- ❌ **POST/PUT/DELETE**: Never cache modifications

### Benefits:
- ⚡ Significantly faster response times
- 📉 Reduced database load
- 💰 Cost savings on database resources
- 📈 Better scalability
- 🎯 Improved user experience

---

## 5️⃣ Rate Limiting

### Status: Not Implemented

### Implementation Steps:

#### Step 1: Install Dependencies
```bash
npm install express-rate-limit
```

#### Step 2: Create Rate Limiter
**File:** `middleware/rateLimiter.js`

```javascript
const rateLimit = require('express-rate-limit');

// General API rate limiter
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict limiter for authentication endpoints
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per 15 minutes
  skipSuccessfulRequests: true,
  message: {
    status: 'error',
    message: 'Too many login attempts, please try again after 15 minutes.'
  }
});

// Moderate limiter for agent operations
exports.agentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    status: 'error',
    message: 'Too many requests, please slow down.'
  }
});
```

#### Step 3: Apply to Routes
```javascript
const { apiLimiter, authLimiter, agentLimiter } = require('./middleware/rateLimiter');

// In index.js - Apply to all routes
app.use('/api/', apiLimiter);

// In routes/auth.js - Apply strict limit to login
router.post('/login', authLimiter, authController.login);

// In routes/agent.js - Apply moderate limit
router.use(agentLimiter);
```

---

## 6️⃣ Logging with Winston

### Status: Not Implemented (Morgan already in use)

### Implementation Steps:

#### Step 1: Install Winston
```bash
npm install winston winston-daily-rotate-file
```

#### Step 2: Configure Logger
**File:** `config/logger.js`

```javascript
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write all logs to rotating file
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    // Write errors to separate file
    new DailyRotateFile({
      level: 'error',
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

module.exports = logger;
```

#### Step 3: Use in Controllers
```javascript
const logger = require('../config/logger');

exports.processTransaction = async (req, res) => {
  try {
    logger.info('Processing transaction', {
      employee_id: req.user.id,
      account_id: req.body.account_id,
      type: req.body.transaction_type
    });
    
    // ... transaction logic ...
    
    logger.info('Transaction completed successfully', { transaction_id });
  } catch (error) {
    logger.error('Transaction failed', {
      error: error.message,
      stack: error.stack,
      employee_id: req.user.id
    });
    // ... error handling ...
  }
};
```

---

## 📊 Implementation Priority

### Phase 1 (Immediate - Week 1)
1. ✅ **Input Validation** - Already created, needs integration
2. 🔒 **Rate Limiting** - Prevent abuse
3. 🧪 **Basic Unit Tests** - Core functionality

### Phase 2 (Short-term - Week 2-3)
4. 📚 **Swagger Documentation** - Developer experience
5. 📝 **Winston Logging** - Better debugging
6. 🧪 **Integration Tests** - E2E testing

### Phase 3 (Medium-term - Month 1-2)
7. ⚡ **Redis Caching** - Performance optimization
8. 📊 **Monitoring** - Application metrics
9. 🔐 **Security Hardening** - Additional security layers

---

## 🎯 Success Metrics

### After Phase 1:
- ✅ Zero invalid requests reaching controllers
- ✅ 5x fewer failed login attempts
- ✅ 60%+ test coverage

### After Phase 2:
- ✅ Complete API documentation
- ✅ Structured logging for all operations
- ✅ 80%+ test coverage

### After Phase 3:
- ✅ 50% faster response times (with caching)
- ✅ 90% reduction in database queries (for cached endpoints)
- ✅ 95%+ uptime

---

**Next Steps:** Start with Phase 1 enhancements for immediate benefits!
