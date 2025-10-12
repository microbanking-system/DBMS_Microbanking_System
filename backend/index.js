const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'microbanking',
  password: '123',
  port: 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('Connected to PostgreSQL database');
  release();
});

const cron = require('node-cron');

// Function to automatically calculate AND credit FD interest (run on 1st of every month)
const processMonthlyFDInterest = async () => {
  console.log('🚀 Starting automatic monthly FD interest processing...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentYear = today.getFullYear();
    
    // Always process the previous month
    const periodStart = new Date(currentYear, today.getMonth() - 1, 1);
    const periodEnd = new Date(currentYear, today.getMonth(), 0); // Last day of previous month
    
    // Format dates as YYYY-MM-DD
    const startDate = periodStart.toISOString().split('T')[0];
    const endDate = periodEnd.toISOString().split('T')[0];
    const processDate = today.toISOString().split('T')[0];

    // Check if this MONTH has already been processed
    const periodCheck = await client.query(`
      SELECT * FROM fd_interest_periods 
      WHERE EXTRACT(MONTH FROM period_start) = $1 
      AND EXTRACT(YEAR FROM period_start) = $2 
      AND is_processed = true
    `, [currentMonth, currentYear]);

    if (periodCheck.rows.length > 0) {
      console.log('✅ Interest for this month already processed');
      await client.query('ROLLBACK');
      return { alreadyProcessed: true, message: 'Interest for this month already processed' };
    }

    console.log(`📅 Processing FD interest for period: ${startDate} to ${endDate}`);

    // Get all active fixed deposits
    const activeFDs = await client.query(`
      SELECT 
        fd.fd_id,
        fd.fd_balance,
        fd.fd_plan_id,
        fp.interest,
        fp.fd_options,
        a.account_id as linked_account_id
      FROM fixeddeposit fd
      JOIN fdplan fp ON fd.fd_plan_id = fp.fd_plan_id
      JOIN account a ON fd.fd_id = a.fd_id
      WHERE fd.fd_status = 'Active'
    `);

    let calculatedCount = 0;
    let creditedCount = 0;
    let totalInterest = 0;

    // Calculate interest for each FD and credit immediately
    for (const fd of activeFDs.rows) {
      // Check if this FD already had interest calculated for current month
      const existingInterest = await client.query(`
        SELECT * FROM fd_interest_calculations 
        WHERE fd_id = $1 
        AND EXTRACT(MONTH FROM calculation_date) = $2 
        AND EXTRACT(YEAR FROM calculation_date) = $3
        AND status = 'credited'
      `, [fd.fd_id, currentMonth, currentYear]);

      if (existingInterest.rows.length > 0) {
        console.log(`⏭️ Interest already credited for FD ${fd.fd_id} this month, skipping`);
        continue;
      }

      const dailyInterestRate = parseFloat(fd.interest) / 100 / 365;
      const interestAmount = parseFloat((parseFloat(fd.fd_balance) * dailyInterestRate * 30).toFixed(2)); // 30-day period
      
      if (interestAmount > 0) {
        try {
          // Update savings account balance (CREDIT THE INTEREST)
          const currentBalanceResult = await client.query(
            'SELECT balance FROM account WHERE account_id = $1',
            [fd.linked_account_id]
          );
          
          const currentBalance = parseFloat(currentBalanceResult.rows[0].balance);
          const newBalance = currentBalance + interestAmount;
          
          await client.query(
            'UPDATE account SET balance = $1 WHERE account_id = $2',
            [newBalance, fd.linked_account_id]
          );

          // Generate transaction ID for interest credit
          const transactionCount = await client.query('SELECT COUNT(*) as count FROM transaction');
          const transactionId = `TXN${String(parseInt(transactionCount.rows[0].count) + 1).padStart(3, '0')}`;

          // Create interest credit transaction (use system user or find an admin)
          const adminUser = await client.query(
            "SELECT employee_id FROM employee WHERE role = 'Admin' LIMIT 1"
          );
          const employeeId = adminUser.rows.length > 0 ? adminUser.rows[0].employee_id : 'A001'; // Fallback

          await client.query(
            `INSERT INTO transaction (transaction_id, transaction_type, amount, time, description, account_id, employee_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [transactionId, 'Interest', interestAmount, today,
             `Monthly FD Interest - ${fd.fd_options} Plan`, fd.linked_account_id, employeeId]
          );

          // Create interest calculation record (marked as credited)
          await client.query(
            `INSERT INTO fd_interest_calculations 
             (fd_id, calculation_date, interest_amount, days_in_period, credited_to_account_id, status, credited_at)
             VALUES ($1, $2, $3, $4, $5, 'credited', $6)`,
            [fd.fd_id, processDate, interestAmount, 30, fd.linked_account_id, today]
          );

          calculatedCount++;
          creditedCount++;
          totalInterest += interestAmount;

          console.log(`💰 Credited LKR ${interestAmount} interest for FD ${fd.fd_id} to account ${fd.linked_account_id}`);

        } catch (error) {
          console.error(`❌ Failed to process interest for FD ${fd.fd_id}:`, error);
          // Create failed record but continue with others
          await client.query(
            `INSERT INTO fd_interest_calculations 
             (fd_id, calculation_date, interest_amount, days_in_period, credited_to_account_id, status)
             VALUES ($1, $2, $3, $4, $5, 'failed')`,
            [fd.fd_id, processDate, interestAmount, 30, fd.linked_account_id]
          );
        }
      }
    }

    // Mark period as processed (only if we actually processed something)
    if (calculatedCount > 0) {
      await client.query(
        `INSERT INTO fd_interest_periods (period_start, period_end, is_processed, processed_at)
         VALUES ($1, $2, true, $3)`,
        [startDate, endDate, processDate]
      );
    }

    // ✅ ADDED: Process matured FDs (JUST ADD THIS SECTION)
    console.log('🔍 Checking for matured Fixed Deposits...');
    
    const maturedFDs = await client.query(`
      SELECT 
        fd.fd_id,
        fd.fd_balance as principal_amount,
        fd.fd_plan_id,
        fd.auto_renewal_status,
        a.account_id as linked_account_id
      FROM fixeddeposit fd
      JOIN account a ON fd.fd_id = a.fd_id
      WHERE fd.fd_status = 'Active' 
      AND fd.maturity_date <= $1
    `, [processDate]);

    let maturedCount = 0;
    let totalPrincipalReturned = 0;

    for (const fd of maturedFDs.rows) {
      try {
        // Return principal amount to savings account
        await client.query(
          'UPDATE account SET balance = balance + $1 WHERE account_id = $2',
          [fd.principal_amount, fd.linked_account_id]
        );

        // Create transaction for principal return
        const transactionCount = await client.query('SELECT COUNT(*) as count FROM transaction');
        const transactionId = `TXN${String(parseInt(transactionCount.rows[0].count) + 1).padStart(3, '0')}`;

        const adminUser = await client.query(
          "SELECT employee_id FROM employee WHERE role = 'Admin' LIMIT 1"
        );
        const employeeId = adminUser.rows.length > 0 ? adminUser.rows[0].employee_id : 'A001';

        await client.query(
          `INSERT INTO transaction (transaction_id, transaction_type, amount, time, description, account_id, employee_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [transactionId, 'Deposit', fd.principal_amount, today,
           `FD Maturity - Principal Return`, fd.linked_account_id, employeeId]
        );

        if (fd.auto_renewal_status === 'True') {
          // Auto-renew: Update maturity date
          const newMaturityDate = new Date(today);
          const planResult = await client.query(
            'SELECT fd_options FROM fdplan WHERE fd_plan_id = $1',
            [fd.fd_plan_id]
          );
          
          const planOption = planResult.rows[0].fd_options;
          switch (planOption) {
            case '6 months':
              newMaturityDate.setMonth(today.getMonth() + 6);
              break;
            case '1 year':
              newMaturityDate.setFullYear(today.getFullYear() + 1);
              break;
            case '3 years':
              newMaturityDate.setFullYear(today.getFullYear() + 3);
              break;
          }

          await client.query(
            `UPDATE fixeddeposit 
             SET open_date = $1, maturity_date = $2 
             WHERE fd_id = $3`,
            [today, newMaturityDate, fd.fd_id]
          );
          console.log(`🔄 Auto-renewed FD ${fd.fd_id}`);
        } else {
          // Close the FD
          await client.query(
            'UPDATE fixeddeposit SET fd_status = $1 WHERE fd_id = $2',
            ['Closed', fd.fd_id]
          );
          await client.query(
            'UPDATE account SET fd_id = NULL WHERE fd_id = $1',
            [fd.fd_id]
          );
          console.log(`🏁 Closed matured FD ${fd.fd_id}`);
        }

        maturedCount++;
        totalPrincipalReturned += parseFloat(fd.principal_amount);

      } catch (error) {
        console.error(`❌ Failed to process matured FD ${fd.fd_id}:`, error);
      }
    }

    console.log(`✅ Matured FDs processed: ${maturedCount}`);
    console.log(`💰 Total Principal Returned: LKR ${totalPrincipalReturned.toLocaleString()}`);
    // ✅ END OF ADDED SECTION

    await client.query('COMMIT');
    
    console.log(`✅ Monthly FD interest processing completed!`);
    console.log(`📊 FDs Processed: ${calculatedCount}`);
    console.log(`💰 Total Interest Credited: LKR ${totalInterest.toLocaleString()}`);
    console.log(`📅 Period: ${startDate} to ${endDate}`);

    return {
      success: true,
      processed: calculatedCount,
      totalInterest: totalInterest,
      period: `${startDate} to ${endDate}`
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in automatic FD interest processing:', error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
};
// Schedule to run on 1st of every month at 3 AM (fully automatic)
cron.schedule('0 3 1 * *', processMonthlyFDInterest);

console.log('✅ FD Interest Auto-Processor: Scheduled for 1st of every month at 3:00 AM');

// For testing: Uncomment this line to run every 10 minutes
// cron.schedule('*/10 * * * *', processMonthlyFDInterest);

// Admin-only registration endpoint
// Update the /api/admin/register endpoint
app.post('/api/admin/register', async (req, res) => {
  // Verify admin authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { 
      role, 
      username, 
      password, 
      first_name, 
      last_name, 
      nic, 
      gender, 
      date_of_birth, 
      branch_id,
      // Contact fields
      contact_no_1,
      contact_no_2,
      address,
      email
    } = req.body;

    // Validation - check required fields
    if (!username || !password || !first_name || !last_name || !nic || !gender || !date_of_birth || !branch_id) {
      return res.status(400).json({ message: 'All basic fields are required' });
    }

    // Contact validation
    if (!contact_no_1 || !address || !email) {
      return res.status(400).json({ message: 'All contact fields are required' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if username already exists
      const checkUserQuery = 'SELECT * FROM employee WHERE username = $1';
      const userResult = await client.query(checkUserQuery, [username]);
      
      if (userResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Generate employee ID based on role
      const countQuery = 'SELECT COUNT(*) as count FROM employee WHERE role = $1';
      const countResult = await client.query(countQuery, [role]);
      const count = parseInt(countResult.rows[0].count);
      const prefix = role.charAt(0).toUpperCase();
      const employee_id = `${prefix}${String(count + 1).padStart(3, '0')}`;

      // Generate contact ID
      const contactCountQuery = 'SELECT COUNT(*) as count FROM contact';
      const contactCountResult = await client.query(contactCountQuery);
      const contactCount = parseInt(contactCountResult.rows[0].count);
      const contact_id = `CT${String(contactCount + 1).padStart(3, '0')}`;

      // Create contact record
      const insertContactQuery = `
        INSERT INTO contact (contact_id, type, contact_no_1, contact_no_2, address, email)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await client.query(insertContactQuery, [
        contact_id, 
        'employee', 
        contact_no_1, 
        contact_no_2 || null, 
        address, 
        email
      ]);

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new employee
      const insertEmployeeQuery = `
        INSERT INTO employee (employee_id, role, username, password, first_name, last_name, nic, gender, date_of_birth, branch_id, contact_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING employee_id
      `;
      
      const insertResult = await client.query(insertEmployeeQuery, [
        employee_id, role, username, hashedPassword, first_name, last_name, 
        nic, gender, date_of_birth, branch_id, contact_id
      ]);

      await client.query('COMMIT');
      
      res.status(201).json({ 
        message: 'User created successfully',
        employee_id: insertResult.rows[0].employee_id,
        contact_id: contact_id
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error: ' + error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});
// Public registration endpoint (REMOVED or DISABLED)
// Comment out or remove this endpoint to prevent public registration
/*
app.post('/api/register', async (req, res) => {
  return res.status(403).json({ message: 'Public registration is disabled. Contact administrator for account creation.' });
});
*/

// Login endpoint - PostgreSQL version
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  console.log('Login attempt:', username);

  const client = await pool.connect();

  try {
    const query = 'SELECT * FROM employee WHERE username = $1';
    const result = await client.query(query, [username]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    
    // Compare password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      console.log('Password does not match');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { id: user.employee_id, role: user.role },
      'your_jwt_secret',
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user.employee_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Get all users (Admin only - for user management)
app.get('/api/admin/users', async (req, res) => {
  // Verify admin authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT employee_id, username, first_name, last_name, role, nic, gender, date_of_birth, branch_id, contact_id, created_at FROM employee ORDER BY created_at DESC'
      );
      
      res.json({ users: result.rows });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// DELETE /api/admin/users/:id - Already exists in your backend
app.delete('/api/admin/users/:id', async (req, res) => {
  // Verify admin authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      const result = await client.query('DELETE FROM employee WHERE employee_id = $1', [id]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Test endpoint to check if server is running
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ 
      message: 'Server and database are running', 
      status: 'OK',
      database_time: result.rows[0].current_time
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Database connection failed', 
      status: 'ERROR' 
    });
  }
});

// Manual trigger for interest processing (for testing/backup)
app.post('/api/admin/fd-interest/process-now', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    console.log('🔄 Manual FD interest processing triggered by admin');
    const result = await processMonthlyFDInterest();
    
    if (result.alreadyProcessed) {
      return res.status(400).json({ 
        message: 'FD interest for this month has already been processed',
        note: 'Interest can only be processed once per month to prevent double payments'
      });
    }
    
    if (result.success) {
      res.json({ 
        message: 'FD interest processing completed successfully',
        processed_count: result.processed,
        total_interest: result.totalInterest,
        period: result.period,
        note: 'This process also runs automatically on the 1st of every month at 3 AM'
      });
    } else {
      res.status(500).json({ 
        message: 'FD interest processing failed',
        error: result.error 
      });
    }

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Get FD interest summary
app.get('/api/admin/fd-interest/summary', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const client = await pool.connect();
    try {
      // Total interest paid this month
      const monthlyInterest = await client.query(`
        SELECT COALESCE(SUM(interest_amount), 0) as total_interest
        FROM fd_interest_calculations 
        WHERE status = 'credited' 
        AND EXTRACT(MONTH FROM credited_at) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM credited_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      `);

      // Active FDs count and total value
      const activeFDs = await client.query(`
        SELECT COUNT(*) as active_count, COALESCE(SUM(fd_balance), 0) as total_value
        FROM fixeddeposit 
        WHERE fd_status = 'Active'
      `);

      // Recent interest periods
      const recentPeriods = await client.query(`
        SELECT period_start, period_end, processed_at
        FROM fd_interest_periods 
        WHERE is_processed = true
        ORDER BY processed_at DESC
        LIMIT 5
      `);

      res.json({
        monthly_interest: parseFloat(monthlyInterest.rows[0].total_interest),
        active_fds: {
          count: parseInt(activeFDs.rows[0].active_count),
          total_value: parseFloat(activeFDs.rows[0].total_value)
        },
        recent_periods: recentPeriods.rows,
        next_scheduled_run: '1st of next month at 3:00 AM'
      });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Branch Management APIs

// GET /api/admin/branches - Get all branches with contact info
app.get('/api/admin/branches', async (req, res) => {
  // Verify admin authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          b.branch_id,
          b.name,
          b.created_at,
          c.contact_id,
          c.contact_no_1,
          c.contact_no_2,
          c.address,
          c.email
        FROM branch b
        JOIN contact c ON b.contact_id = c.contact_id
        ORDER BY b.created_at DESC
      `);
      
      res.json({ branches: result.rows });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// POST /api/admin/branches - Create new branch
app.post('/api/admin/branches', async (req, res) => {
  // Verify admin authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { branch_id, name, contact_no_1, contact_no_2, address, email } = req.body;

    // Validation
    if (!branch_id || !name || !contact_no_1 || !address || !email) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if branch already exists
      const branchCheck = await client.query('SELECT * FROM branch WHERE branch_id = $1', [branch_id]);
      if (branchCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Branch ID already exists' });
      }

      // Generate contact ID
      const contactCount = await client.query('SELECT COUNT(*) as count FROM contact');
      const contactId = `CT${String(parseInt(contactCount.rows[0].count) + 1).padStart(3, '0')}`;

      // Create contact record
      await client.query(
        `INSERT INTO contact (contact_id, type, contact_no_1, contact_no_2, address, email)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [contactId, 'branch', contact_no_1, contact_no_2 || null, address, email]
      );

      // Create branch record
      await client.query(
        `INSERT INTO branch (branch_id, name, contact_id)
         VALUES ($1, $2, $3)`,
        [branch_id, name, contactId]
      );

      await client.query('COMMIT');
      
      res.status(201).json({ 
        message: 'Branch created successfully',
        branch_id: branch_id
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// DELETE /api/admin/branches/:id - Delete branch
app.delete('/api/admin/branches/:id', async (req, res) => {
  // Verify admin authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get contact_id for the branch
      const branchResult = await client.query('SELECT contact_id FROM branch WHERE branch_id = $1', [id]);
      if (branchResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Branch not found' });
      }

      const contactId = branchResult.rows[0].contact_id;

      // Check if branch has employees
      const employeesCheck = await client.query('SELECT COUNT(*) as count FROM employee WHERE branch_id = $1', [id]);
      if (parseInt(employeesCheck.rows[0].count) > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Cannot delete branch with assigned employees. Reassign employees first.' });
      }

      // Check if branch has accounts
      const accountsCheck = await client.query('SELECT COUNT(*) as count FROM account WHERE branch_id = $1', [id]);
      if (parseInt(accountsCheck.rows[0].count) > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Cannot delete branch with associated accounts. Transfer accounts first.' });
      }

      // Delete branch
      await client.query('DELETE FROM branch WHERE branch_id = $1', [id]);
      
      // Delete contact
      await client.query('DELETE FROM contact WHERE contact_id = $1', [contactId]);

      await client.query('COMMIT');
      
      res.json({ message: 'Branch deleted successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Customer Registration API - Agent only
app.post('/api/agent/customers/register', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const { first_name, last_name, nic, gender, date_of_birth, contact_no_1, contact_no_2, address, email } = req.body;

    // Validation
    if (!first_name || !last_name || !nic || !gender || !date_of_birth || !contact_no_1 || !address || !email) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Age validation
    const dob = new Date(date_of_birth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    if (age < 18) {
      return res.status(400).json({ message: 'Customer must be at least 18 years old' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if customer with NIC already exists
      const customerCheck = await client.query('SELECT * FROM customer WHERE nic = $1', [nic]);
      if (customerCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Customer with this NIC already exists' });
      }

      // Generate customer ID
      const customerCount = await client.query('SELECT COUNT(*) as count FROM customer');
      const customerId = `CUST${String(parseInt(customerCount.rows[0].count) + 1).padStart(3, '0')}`;

      // Generate contact ID
      const contactCount = await client.query('SELECT COUNT(*) as count FROM contact');
      const contactId = `CT${String(parseInt(contactCount.rows[0].count) + 1).padStart(3, '0')}`;

      // Create contact record
      await client.query(
        `INSERT INTO contact (contact_id, type, contact_no_1, contact_no_2, address, email)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [contactId, 'customer', contact_no_1, contact_no_2 || null, address, email]
      );

      // Create customer record
      await client.query(
        `INSERT INTO customer (customer_id, first_name, last_name, gender, nic, date_of_birth, contact_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [customerId, first_name, last_name, gender, nic, date_of_birth, contactId]
      );

      await client.query('COMMIT');
      
      res.status(201).json({ 
        message: 'Customer registered successfully',
        customer_id: customerId
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Get all customers for account creation (updated to include date_of_birth)
app.get('/api/agent/customers', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT customer_id, first_name, last_name, nic, date_of_birth 
        FROM customer 
        ORDER BY first_name, last_name
      `);
      
      res.json({ customers: result.rows });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});
// Get all saving plans
app.get('/api/saving-plans', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT saving_plan_id, plan_type, interest, min_balance 
      FROM savingplan 
      ORDER BY plan_type
    `);
    
    res.json({ saving_plans: result.rows });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Get all branches
app.get('/api/branches', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT branch_id, name 
      FROM branch 
      ORDER BY name
    `);
    
    res.json({ branches: result.rows });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Create account for customer (with joint account support)
app.post('/api/agent/accounts/create', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const { customer_id, saving_plan_id, initial_deposit, branch_id, joint_holders = [] } = req.body;

    // Validation
    if (!customer_id || !saving_plan_id || !branch_id || initial_deposit === undefined) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    if (initial_deposit < 0) {
      return res.status(400).json({ message: 'Initial deposit cannot be negative' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get saving plan details for validation
      const planResult = await client.query('SELECT * FROM savingplan WHERE saving_plan_id = $1', [saving_plan_id]);
      if (planResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Invalid saving plan' });
      }

      const savingPlan = planResult.rows[0];
      
      // Joint account validation
      if (savingPlan.plan_type === 'Joint' && joint_holders.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Joint account requires at least one joint holder' });
      }

      if (initial_deposit < savingPlan.min_balance) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: `Minimum deposit for ${savingPlan.plan_type} plan is LKR ${savingPlan.min_balance}` 
        });
      }

      // Verify primary customer exists and is at least 18 years old
      const customerResult = await client.query(
        'SELECT *, EXTRACT(YEAR FROM AGE(date_of_birth)) as age FROM customer WHERE customer_id = $1',
        [customer_id]
      );
      if (customerResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Primary customer not found' });
      }

      const primaryCustomer = customerResult.rows[0];
      if (parseInt(primaryCustomer.age) < 18) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Primary account holder must be at least 18 years old' });
      }

      // Verify joint holders exist and are at least 18 years old
      if (joint_holders.length > 0) {
        const jointHoldersResult = await client.query(
          `SELECT customer_id, first_name, last_name, EXTRACT(YEAR FROM AGE(date_of_birth)) as age 
           FROM customer WHERE customer_id = ANY($1)`,
          [joint_holders]
        );

        if (jointHoldersResult.rows.length !== joint_holders.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'One or more joint holders not found' });
        }

        const underageJointHolder = jointHoldersResult.rows.find(holder => parseInt(holder.age) < 18);
        if (underageJointHolder) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            message: `Joint holder ${underageJointHolder.first_name} ${underageJointHolder.last_name} must be at least 18 years old` 
          });
        }
      }

      // Verify branch exists
      const branchResult = await client.query('SELECT * FROM branch WHERE branch_id = $1', [branch_id]);
      if (branchResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Branch not found' });
      }

      // Generate account ID
      const accountCount = await client.query('SELECT COUNT(*) as count FROM account');
      const accountId = `ACC${String(parseInt(accountCount.rows[0].count) + 1).padStart(3, '0')}`;

      // Create account record
      await client.query(
        `INSERT INTO account (account_id, open_date, account_status, balance, saving_plan_id, branch_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [accountId, new Date().toISOString().split('T')[0], 'Active', initial_deposit, saving_plan_id, branch_id]
      );

      // Create takes relationship for primary customer
      const takesCount = await client.query('SELECT COUNT(*) as count FROM takes');
      let takesIdCounter = parseInt(takesCount.rows[0].count) + 1;

      await client.query(
        `INSERT INTO takes (takes_id, customer_id, account_id)
         VALUES ($1, $2, $3)`,
        [`T${String(takesIdCounter).padStart(3, '0')}`, customer_id, accountId]
      );

      takesIdCounter++;

      // Create takes relationships for joint holders
      for (const jointCustomerId of joint_holders) {
        await client.query(
          `INSERT INTO takes (takes_id, customer_id, account_id)
           VALUES ($1, $2, $3)`,
          [`T${String(takesIdCounter).padStart(3, '0')}`, jointCustomerId, accountId]
        );
        takesIdCounter++;
      }

      // Create initial transaction if deposit > 0
      if (initial_deposit > 0) {
        const transactionCount = await client.query('SELECT COUNT(*) as count FROM transaction');
        const transactionId = `TXN${String(parseInt(transactionCount.rows[0].count) + 1).padStart(3, '0')}`;

        await client.query(
          `INSERT INTO transaction (transaction_id, transaction_type, amount, time, description, account_id, employee_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [transactionId, 'Deposit', initial_deposit, new Date(), 'Initial Deposit', accountId, decoded.id]
        );
      }

      await client.query('COMMIT');
      
      res.status(201).json({ 
        message: 'Account created successfully',
        account_id: accountId,
        joint_holders_count: joint_holders.length
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error: ' + error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});
// Get accounts for transaction processing (FIXED for joint accounts)
app.get('/api/agent/accounts', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT DISTINCT
          a.account_id,
          a.balance,
          a.account_status,
          STRING_AGG(DISTINCT c.first_name || ' ' || c.last_name, ', ') as customer_names
        FROM account a
        JOIN takes t ON a.account_id = t.account_id
        JOIN customer c ON t.customer_id = c.customer_id
        WHERE a.account_status = 'Active'
        GROUP BY a.account_id, a.balance, a.account_status
        ORDER BY a.account_id
      `);
      
      res.json({ accounts: result.rows });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Process transaction (deposit/withdrawal)
app.post('/api/agent/transactions/process', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const { account_id, transaction_type, amount, description } = req.body;

    // Validation
    if (!account_id || !transaction_type || amount === undefined || !description) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: 'Amount must be positive' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if account exists and get current balance
      const accountResult = await client.query(
        'SELECT * FROM account WHERE account_id = $1 AND account_status = $2',
        [account_id, 'Active']
      );

      if (accountResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Account not found or inactive' });
      }

      const account = accountResult.rows[0];
      let newBalance = account.balance;

      // Process based on transaction type
      if (transaction_type === 'Deposit') {
        newBalance = parseFloat(account.balance) + parseFloat(amount);
      } else if (transaction_type === 'Withdrawal') {
        if (parseFloat(account.balance) < parseFloat(amount)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Insufficient balance' });
        }
        newBalance = parseFloat(account.balance) - parseFloat(amount);
      } else {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Invalid transaction type' });
      }

      // Update account balance
      await client.query(
        'UPDATE account SET balance = $1 WHERE account_id = $2',
        [newBalance, account_id]
      );

      // Generate transaction ID
      const transactionCount = await client.query('SELECT COUNT(*) as count FROM transaction');
      const transactionId = `TXN${String(parseInt(transactionCount.rows[0].count) + 1).padStart(3, '0')}`;

      // Create transaction record
      await client.query(
        `INSERT INTO transaction (transaction_id, transaction_type, amount, time, description, account_id, employee_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [transactionId, transaction_type, amount, new Date(), description, account_id, decoded.id]
      );

      await client.query('COMMIT');
      
      res.status(201).json({ 
        message: 'Transaction processed successfully',
        transaction_id: transactionId,
        new_balance: newBalance
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error: ' + error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Get recent transactions
app.get('/api/agent/transactions/recent', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          transaction_id,
          transaction_type,
          amount,
          time,
          description,
          account_id,
          employee_id
        FROM transaction 
        ORDER BY time DESC 
        LIMIT 50
      `);
      
      res.json({ transactions: result.rows });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});
// Get agent performance metrics
app.get('/api/agent/performance', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const client = await pool.connect();
    try {
      const employeeId = decoded.id;
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Today's transactions count
      const todayTransactionsResult = await client.query(
        `SELECT COUNT(*) as count FROM transaction 
         WHERE employee_id = $1 AND DATE(time) = $2`,
        [employeeId, today]
      );

      // Total customers registered by this agent
      const totalCustomersResult = await client.query(
        `SELECT COUNT(DISTINCT t.customer_id) as count 
         FROM takes t
         JOIN account a ON t.account_id = a.account_id
         JOIN transaction tr ON a.account_id = tr.account_id
         WHERE tr.employee_id = $1 AND tr.transaction_type = 'Deposit'`,
        [employeeId]
      );

      // Monthly accounts created
      const monthlyAccountsResult = await client.query(
        `SELECT COUNT(DISTINCT a.account_id) as count 
         FROM account a
         JOIN transaction tr ON a.account_id = tr.account_id
         WHERE tr.employee_id = $1 AND EXTRACT(MONTH FROM tr.time) = $2 
         AND EXTRACT(YEAR FROM tr.time) = $3`,
        [employeeId, currentMonth, currentYear]
      );

      // Total transaction volume
      const transactionVolumeResult = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM transaction 
         WHERE employee_id = $1`,
        [employeeId]
      );

      // Recent activity
      const recentActivityResult = await client.query(
        `SELECT 
          'transaction' as type,
          transaction_type || ' - ' || description as description,
          time
         FROM transaction 
         WHERE employee_id = $1 
         UNION ALL
         SELECT 
          'account' as type,
          'Account created for ' || c.first_name || ' ' || c.last_name as description,
          a.open_date as time
         FROM account a
         JOIN takes t ON a.account_id = t.account_id
         JOIN customer c ON t.customer_id = c.customer_id
         JOIN transaction tr ON a.account_id = tr.account_id
         WHERE tr.employee_id = $1 AND tr.transaction_type = 'Deposit'
         ORDER BY time DESC 
         LIMIT 10`,
        [employeeId]
      );

      const performanceData = {
        today_transactions: parseInt(todayTransactionsResult.rows[0].count),
        total_customers: parseInt(totalCustomersResult.rows[0].count),
        monthly_accounts: parseInt(monthlyAccountsResult.rows[0].count),
        transaction_volume: parseFloat(transactionVolumeResult.rows[0].total),
        recent_activity: recentActivityResult.rows
      };

      res.json(performanceData);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Get manager's team agents and their performance
app.get('/api/manager/team/agents', async (req, res) => {
  // Verify manager authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Manager' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Manager access required' });
    }

    const client = await pool.connect();
    try {
      // Get manager's branch
      const managerResult = await client.query(
        'SELECT branch_id FROM employee WHERE employee_id = $1',
        [decoded.id]
      );

      if (managerResult.rows.length === 0) {
        return res.status(404).json({ message: 'Manager not found' });
      }

      const branchId = managerResult.rows[0].branch_id;

      // Get agents in the same branch
      const agentsResult = await client.query(`
        SELECT 
          e.employee_id, e.username, e.first_name, e.last_name, e.role,
          e.nic, e.gender, e.date_of_birth, e.branch_id, e.contact_id, e.created_at,
          c.contact_no_1, c.contact_no_2, c.email, c.address
        FROM employee e
        LEFT JOIN contact c ON e.contact_id = c.contact_id
        WHERE e.branch_id = $1 AND e.role = 'Agent'
        ORDER BY e.first_name, e.last_name
      `, [branchId]);

      // Get performance data for each agent
      const performanceData = {};
      for (const agent of agentsResult.rows) {
        const performanceResult = await client.query(`
          SELECT 
            COUNT(*) as total_transactions,
            COALESCE(SUM(amount), 0) as total_volume,
            COUNT(DISTINCT t.customer_id) as customers_registered,
            COUNT(DISTINCT a.account_id) as accounts_created,
            MAX(tr.time) as last_activity
          FROM transaction tr
          LEFT JOIN account a ON tr.account_id = a.account_id
          LEFT JOIN takes t ON a.account_id = t.account_id
          WHERE tr.employee_id = $1
        `, [agent.employee_id]);

        performanceData[agent.employee_id] = {
          total_transactions: parseInt(performanceResult.rows[0].total_transactions),
          total_volume: parseFloat(performanceResult.rows[0].total_volume),
          customers_registered: parseInt(performanceResult.rows[0].customers_registered),
          accounts_created: parseInt(performanceResult.rows[0].accounts_created),
          last_activity: performanceResult.rows[0].last_activity
        };
      }

      res.json({
        agents: agentsResult.rows,
        performance: performanceData
      });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Get specific agent's transactions
app.get('/api/manager/team/agents/:agentId/transactions', async (req, res) => {
  // Verify manager authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Manager' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Manager access required' });
    }

    const { agentId } = req.params;
    const client = await pool.connect();
    try {
      const transactionsResult = await client.query(`
        SELECT 
          transaction_id, transaction_type, amount, time, description, account_id, employee_id
        FROM transaction 
        WHERE employee_id = $1
        ORDER BY time DESC
        LIMIT 50
      `, [agentId]);

      res.json({
        transactions: transactionsResult.rows
      });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Get branch transactions with filters (UPDATED - removed agent summary)
app.get('/api/manager/transactions', async (req, res) => {
  // Verify manager authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Manager' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Manager access required' });
    }

    const { start, end } = req.query;
    const client = await pool.connect();
    try {
      // Get manager's branch
      const managerResult = await client.query(
        'SELECT branch_id FROM employee WHERE employee_id = $1',
        [decoded.id]
      );

      if (managerResult.rows.length === 0) {
        return res.status(404).json({ message: 'Manager not found' });
      }

      const branchId = managerResult.rows[0].branch_id;

      // Get transactions for the branch with agent names
      const transactionsResult = await client.query(`
        SELECT 
          t.transaction_id, t.transaction_type, t.amount, t.time, t.description,
          t.account_id, t.employee_id,
          e.first_name || ' ' || e.last_name as employee_name
        FROM transaction t
        JOIN employee e ON t.employee_id = e.employee_id
        JOIN account a ON t.account_id = a.account_id
        WHERE a.branch_id = $1 
        AND DATE(t.time) BETWEEN $2 AND $3
        ORDER BY t.time DESC
        LIMIT 100
      `, [branchId, start, end]);

      // Get summary data (without agent summary)
      const summaryResult = await client.query(`
        SELECT 
          COUNT(*) as transaction_count,
          COALESCE(SUM(CASE WHEN transaction_type = 'Deposit' THEN amount ELSE 0 END), 0) as total_deposits,
          COALESCE(SUM(CASE WHEN transaction_type = 'Withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawals,
          COALESCE(SUM(CASE WHEN transaction_type = 'Deposit' THEN amount ELSE -amount END), 0) as net_flow
        FROM transaction t
        JOIN account a ON t.account_id = a.account_id
        WHERE a.branch_id = $1 AND DATE(t.time) BETWEEN $2 AND $3
      `, [branchId, start, end]);

      const summary = {
        total_deposits: parseFloat(summaryResult.rows[0].total_deposits),
        total_withdrawals: parseFloat(summaryResult.rows[0].total_withdrawals),
        net_flow: parseFloat(summaryResult.rows[0].net_flow),
        transaction_count: parseInt(summaryResult.rows[0].transaction_count)
      };

      res.json({
        transactions: transactionsResult.rows,
        summary: summary
      });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});
// Get customer accounts for manager's branch
app.get('/api/manager/accounts', async (req, res) => {
  // Verify manager authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Manager' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Manager access required' });
    }

    const client = await pool.connect();
    try {
      // Get manager's branch
      const managerResult = await client.query(
        'SELECT branch_id FROM employee WHERE employee_id = $1',
        [decoded.id]
      );

      if (managerResult.rows.length === 0) {
        return res.status(404).json({ message: 'Manager not found' });
      }

      const branchId = managerResult.rows[0].branch_id;

      // Get accounts with customer and saving plan details
      const accountsResult = await client.query(`
        SELECT 
          a.account_id,
          a.open_date,
          a.account_status,
          a.balance,
          a.branch_id,
          a.saving_plan_id,
          c.customer_id,
          c.first_name,
          c.last_name,
          c.nic,
          c.gender,
          c.date_of_birth,
          ct.contact_no_1,
          ct.email,
          ct.address,
          sp.plan_type,
          sp.interest,
          sp.min_balance
        FROM account a
        JOIN takes t ON a.account_id = t.account_id
        JOIN customer c ON t.customer_id = c.customer_id
        JOIN contact ct ON c.contact_id = ct.contact_id
        LEFT JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id
        WHERE a.branch_id = $1
        ORDER BY a.balance DESC
      `, [branchId]);

      // Calculate summary statistics
      const activeAccounts = accountsResult.rows.filter(acc => acc.account_status === 'Active');
      const totalBalance = activeAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
      
      const summary = {
        total_accounts: accountsResult.rows.length,
        active_accounts: activeAccounts.length,
        inactive_accounts: accountsResult.rows.length - activeAccounts.length,
        total_balance: totalBalance,
        average_balance: activeAccounts.length > 0 ? totalBalance / activeAccounts.length : 0
      };

      res.json({
        accounts: accountsResult.rows,
        summary: summary
      });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});
// Get all FD plans
app.get('/api/fd-plans', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT fd_plan_id, fd_options, interest 
      FROM fdplan 
      ORDER BY fd_options
    `);
    
    res.json({ fd_plans: result.rows });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Create fixed deposit account
app.post('/api/agent/fixed-deposits/create', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const { customer_id, account_id, fd_plan_id, principal_amount, auto_renewal_status } = req.body;

    // Validation
    if (!customer_id || !account_id || !fd_plan_id || principal_amount === undefined) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    if (principal_amount <= 0) {
      return res.status(400).json({ message: 'Principal amount must be greater than 0' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify customer exists and is at least 18 years old
      const customerResult = await client.query(
        'SELECT *, EXTRACT(YEAR FROM AGE(date_of_birth)) as age FROM customer WHERE customer_id = $1',
        [customer_id]
      );
      if (customerResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Customer not found' });
      }

      const customer = customerResult.rows[0];
      if (parseInt(customer.age) < 18) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Customer must be at least 18 years old for Fixed Deposit' });
      }

      // Verify account exists and has sufficient balance (WITH MINIMUM BALANCE CHECK)
      const accountResult = await client.query(
        `SELECT a.*, sp.min_balance, sp.plan_type 
         FROM account a 
         JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id 
         WHERE a.account_id = $1 AND a.account_status = $2`,
        [account_id, 'Active']
      );
      if (accountResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Account not found or inactive' });
      }

      const account = accountResult.rows[0];
      const minBalance = parseFloat(account.min_balance);
      const availableForFD = parseFloat(account.balance) - minBalance;

      if (parseFloat(principal_amount) > availableForFD) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: `Insufficient balance. Maximum FD amount: LKR ${availableForFD.toFixed(2)}. Minimum balance of LKR ${minBalance.toFixed(2)} must remain in savings account for ${account.plan_type} plan` 
        });
      }

      // Verify FD plan exists
      const planResult = await client.query('SELECT * FROM fdplan WHERE fd_plan_id = $1', [fd_plan_id]);
      if (planResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Invalid FD plan' });
      }

      const fdPlan = planResult.rows[0];

      // Calculate maturity date based on plan
      const openDate = new Date();
      const maturityDate = new Date(openDate);
      
      switch (fdPlan.fd_options) {
        case '6 months':
          maturityDate.setMonth(openDate.getMonth() + 6);
          break;
        case '1 year':
          maturityDate.setFullYear(openDate.getFullYear() + 1);
          break;
        case '3 years':
          maturityDate.setFullYear(openDate.getFullYear() + 3);
          break;
      }

      // Generate FD account ID
      const fdCount = await client.query('SELECT COUNT(*) as count FROM fixeddeposit');
      const fdId = `FD${String(parseInt(fdCount.rows[0].count) + 1).padStart(3, '0')}`;

      // Create fixed deposit record
      await client.query(
        `INSERT INTO fixeddeposit (fd_id, fd_balance, auto_renewal_status, fd_status, open_date, maturity_date, fd_plan_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [fdId, principal_amount, auto_renewal_status, 'Active', openDate, maturityDate, fd_plan_id]
      );

      // Update savings account balance (deduct principal amount)
      const newBalance = parseFloat(account.balance) - parseFloat(principal_amount);
      await client.query(
        'UPDATE account SET balance = $1 WHERE account_id = $2',
        [newBalance, account_id]
      );

      // Link FD to account (update account table with fd_id)
      await client.query(
        'UPDATE account SET fd_id = $1 WHERE account_id = $2',
        [fdId, account_id]
      );

      // Create withdrawal transaction for the principal amount
      const transactionCount = await client.query('SELECT COUNT(*) as count FROM transaction');
      const transactionId = `TXN${String(parseInt(transactionCount.rows[0].count) + 1).padStart(3, '0')}`;

      await client.query(
        `INSERT INTO transaction (transaction_id, transaction_type, amount, time, description, account_id, employee_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [transactionId, 'Withdrawal', principal_amount, new Date(), 
         `Fixed Deposit Creation - ${fdPlan.fd_options} Plan`, account_id, decoded.id]
      );

      await client.query('COMMIT');
      
      res.status(201).json({ 
        message: 'Fixed Deposit created successfully',
        fd_account_number: fdId,
        maturity_date: maturityDate.toISOString().split('T')[0],
        new_savings_balance: newBalance
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error: ' + error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});
// Get accounts with FD information (updated to exclude joint accounts)
app.get('/api/agent/accounts-with-fd', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const client = await pool.connect();
    try {
      
      const result = await client.query(`
        SELECT 
          a.account_id,
          a.balance,
          a.account_status,
          a.fd_id,
          sp.plan_type,
          sp.min_balance,
          sp.interest,
          (
            SELECT STRING_AGG(c.first_name || ' ' || c.last_name, ', ')
            FROM takes t2
            JOIN customer c ON t2.customer_id = c.customer_id
            WHERE t2.account_id = a.account_id
          ) as customer_names,
          (
            SELECT COUNT(DISTINCT customer_id)
            FROM takes t3
            WHERE t3.account_id = a.account_id
          ) as customer_count
        FROM account a
        JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id
        WHERE a.account_status = 'Active'
        ORDER BY a.account_id
      `);
      
      res.json({ accounts: result.rows });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Get all fixed deposits
app.get('/api/agent/fixed-deposits', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          fd.fd_id,
          fd.fd_balance,
          fd.fd_status,
          fd.open_date,
          fd.maturity_date,
          fd.auto_renewal_status,
          fp.fd_options,
          fp.interest,
          a.account_id,
          STRING_AGG(DISTINCT c.first_name || ' ' || c.last_name, ', ') as customer_names
        FROM fixeddeposit fd
        JOIN fdplan fp ON fd.fd_plan_id = fp.fd_plan_id
        JOIN account a ON fd.fd_id = a.fd_id
        JOIN takes t ON a.account_id = t.account_id
        JOIN customer c ON t.customer_id = c.customer_id
        GROUP BY fd.fd_id, fd.fd_balance, fd.fd_status, fd.open_date, fd.maturity_date, 
                 fd.auto_renewal_status, fp.fd_options, fp.interest, a.account_id
        ORDER BY fd.open_date DESC
      `);
      
      res.json({ fixed_deposits: result.rows });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Enhanced search fixed deposits - supports FD ID, customer name, and account ID
app.get('/api/agent/fixed-deposits/search', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          fd.fd_id,
          fd.fd_balance,
          fd.fd_status,
          fd.open_date,
          fd.maturity_date,
          fd.auto_renewal_status,
          fp.fd_options,
          fp.interest,
          a.account_id,
          STRING_AGG(DISTINCT c.first_name || ' ' || c.last_name, ', ') as customer_names
        FROM fixeddeposit fd
        JOIN fdplan fp ON fd.fd_plan_id = fp.fd_plan_id
        JOIN account a ON fd.fd_id = a.fd_id
        JOIN takes t ON a.account_id = t.account_id
        JOIN customer c ON t.customer_id = c.customer_id
        WHERE 
          fd.fd_id ILIKE $1 OR 
          a.account_id ILIKE $1 OR
          c.first_name ILIKE $1 OR 
          c.last_name ILIKE $1 OR
          (c.first_name || ' ' || c.last_name) ILIKE $1 OR
          (c.last_name || ' ' || c.first_name) ILIKE $1
        GROUP BY fd.fd_id, fd.fd_balance, fd.fd_status, fd.open_date, fd.maturity_date, 
                 fd.auto_renewal_status, fp.fd_options, fp.interest, a.account_id
        ORDER BY fd.open_date DESC
      `, [`%${query}%`]);
      
      res.json({ fixed_deposits: result.rows });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Deactivate fixed deposit - FIXED VERSION (returns principal amount)
app.post('/api/agent/fixed-deposits/deactivate', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const { fd_id } = req.body;

    if (!fd_id) {
      return res.status(400).json({ message: 'FD ID is required' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if FD exists and is active
      const fdResult = await client.query(
        'SELECT * FROM fixeddeposit WHERE fd_id = $1 AND fd_status = $2',
        [fd_id, 'Active']
      );

      if (fdResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Active fixed deposit not found' });
      }

      const fd = fdResult.rows[0];

      // Get the linked account ID
      const accountResult = await client.query(
        'SELECT account_id FROM account WHERE fd_id = $1',
        [fd_id]
      );
      
      if (accountResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Linked savings account not found' });
      }

      const accountId = accountResult.rows[0].account_id;

      // ✅ CRITICAL FIX: Return principal amount to savings account
      await client.query(
        'UPDATE account SET balance = balance + $1 WHERE account_id = $2',
        [fd.fd_balance, accountId]
      );

      // ✅ Create transaction record for principal return
      const transactionCount = await client.query('SELECT COUNT(*) as count FROM transaction');
      const transactionId = `TXN${String(parseInt(transactionCount.rows[0].count) + 1).padStart(3, '0')}`;

      await client.query(
        `INSERT INTO transaction (transaction_id, transaction_type, amount, time, description, account_id, employee_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [transactionId, 'Deposit', fd.fd_balance, new Date(), 
         `FD Deactivation - Principal Return (${fd_id})`, accountId, decoded.id]
      );

      // Update FD status to Closed
      await client.query(
        'UPDATE fixeddeposit SET fd_status = $1 WHERE fd_id = $2',
        ['Closed', fd_id]
      );

      // Remove FD reference from account
      await client.query(
        'UPDATE account SET fd_id = NULL WHERE fd_id = $1',
        [fd_id]
      );

      await client.query('COMMIT');
      
      res.json({ 
        message: 'Fixed deposit deactivated successfully. Principal amount returned to savings account.',
        fd_id: fd_id,
        principal_returned: fd.fd_balance,
        account_id: accountId
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error: ' + error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});
// Get all accounts with basic information
app.get('/api/agent/all-accounts', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          a.account_id,
          a.balance,
          a.account_status,
          a.open_date,
          a.branch_id,
          a.saving_plan_id,
          a.fd_id,
          sp.plan_type,
          sp.interest,
          sp.min_balance,
          STRING_AGG(DISTINCT c.first_name || ' ' || c.last_name, ', ') as customer_names,
          COUNT(DISTINCT t.customer_id) as customer_count
        FROM account a
        JOIN takes t ON a.account_id = t.account_id
        JOIN customer c ON t.customer_id = c.customer_id
        JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id
        GROUP BY a.account_id, a.balance, a.account_status, a.open_date, a.branch_id, 
                 a.saving_plan_id, a.fd_id, sp.plan_type, sp.interest, sp.min_balance
        ORDER BY a.open_date DESC
      `);
      
      res.json({ accounts: result.rows });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Get detailed account information
app.get('/api/agent/accounts/:accountId/details', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const { accountId } = req.params;
    const client = await pool.connect();
    try {
      // Get basic account information with branch name
      const accountResult = await client.query(`
        SELECT 
          a.account_id,
          a.balance,
          a.account_status,
          a.open_date,
          b.name as branch_name,
          sp.plan_type,
          sp.interest,
          sp.min_balance
        FROM account a
        JOIN branch b ON a.branch_id = b.branch_id
        JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id
        WHERE a.account_id = $1
      `, [accountId]);

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ message: 'Account not found' });
      }

      const account = accountResult.rows[0];

      // Get customer information
      const customersResult = await client.query(`
        SELECT 
          c.customer_id,
          c.first_name,
          c.last_name,
          c.nic,
          c.date_of_birth
        FROM customer c
        JOIN takes t ON c.customer_id = t.customer_id
        WHERE t.account_id = $1
      `, [accountId]);

      // Get recent transactions (last 20)
      const transactionsResult = await client.query(`
        SELECT 
          transaction_id,
          transaction_type,
          amount,
          time,
          description
        FROM transaction 
        WHERE account_id = $1
        ORDER BY time DESC
        LIMIT 20
      `, [accountId]);

      const accountDetails = {
        ...account,
        customers: customersResult.rows,
        transactions: transactionsResult.rows
      };

      res.json({ account: accountDetails });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Search accounts by account ID or customer name
app.get('/api/agent/accounts/search/:searchTerm', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const { searchTerm } = req.params;
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          a.account_id,
          a.balance,
          a.account_status,
          a.open_date,
          a.branch_id,
          a.saving_plan_id,
          a.fd_id,
          sp.plan_type,
          sp.interest,
          sp.min_balance,
          STRING_AGG(DISTINCT c.first_name || ' ' || c.last_name, ', ') as customer_names,
          COUNT(DISTINCT t.customer_id) as customer_count,
          b.name as branch_name
        FROM account a
        JOIN takes t ON a.account_id = t.account_id
        JOIN customer c ON t.customer_id = c.customer_id
        JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id
        JOIN branch b ON a.branch_id = b.branch_id
        WHERE a.account_id ILIKE $1 OR c.first_name ILIKE $1 OR c.last_name ILIKE $1
        GROUP BY a.account_id, a.balance, a.account_status, a.open_date, a.branch_id, 
                 a.saving_plan_id, a.fd_id, sp.plan_type, sp.interest, sp.min_balance, b.name
        ORDER BY a.open_date DESC
      `, [`%${searchTerm}%`]);
      
      res.json({ accounts: result.rows });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Deactivate savings account - UPDATED to automatically withdraw full balance
app.post('/api/agent/accounts/deactivate', async (req, res) => {
  // Verify agent authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Agent' && decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Agent access required' });
    }

    const { account_id, reason } = req.body;

    if (!account_id) {
      return res.status(400).json({ message: 'Account ID is required' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if account exists and is active
      const accountResult = await client.query(
        'SELECT * FROM account WHERE account_id = $1 AND account_status = $2',
        [account_id, 'Active']
      );

      if (accountResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Active account not found' });
      }

      const account = accountResult.rows[0];

      // Check if account has an active FD
      if (account.fd_id) {
        const fdResult = await client.query(
          'SELECT * FROM fixeddeposit WHERE fd_id = $1 AND fd_status = $2',
          [account.fd_id, 'Active']
        );
        
        if (fdResult.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            message: 'Cannot deactivate account with active Fixed Deposit. Please deactivate the FD first.' 
          });
        }
      }

      let withdrawalAmount = parseFloat(account.balance);
      let withdrawalTransactionId = null;

      // If account has balance, create withdrawal transaction
      if (withdrawalAmount > 0) {
        // Generate transaction ID for withdrawal
        const transactionCount = await client.query('SELECT COUNT(*) as count FROM transaction');
        withdrawalTransactionId = `TXN${String(parseInt(transactionCount.rows[0].count) + 1).padStart(3, '0')}`;

        // Create withdrawal transaction record
        await client.query(
          `INSERT INTO transaction (transaction_id, transaction_type, amount, time, description, account_id, employee_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [withdrawalTransactionId, 'Withdrawal', withdrawalAmount, new Date(), 
           `Account Closure - Full Balance Withdrawal - ${reason || 'No reason provided'}`, account_id, decoded.id]
        );

        // Update account balance to 0
        await client.query(
          'UPDATE account SET balance = $1 WHERE account_id = $2',
          [0, account_id]
        );
      }

      // Update account status to Inactive
      await client.query(
        'UPDATE account SET account_status = $1 WHERE account_id = $2',
        ['Inactive', account_id]
      );

      // Create additional transaction record for account deactivation (audit trail)
      const deactivationTransactionCount = await client.query('SELECT COUNT(*) as count FROM transaction');
      const deactivationTransactionId = `TXN${String(parseInt(deactivationTransactionCount.rows[0].count) + 1).padStart(3, '0')}`;

      await client.query(
        `INSERT INTO transaction (transaction_id, transaction_type, amount, time, description, account_id, employee_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [deactivationTransactionId, 'Withdrawal', 0, new Date(), 
         `Account Deactivated - ${reason || 'No reason provided'}`, account_id, decoded.id]
      );

      await client.query('COMMIT');
      
      const responseData = { 
        message: 'Account deactivated successfully',
        account_id: account_id,
        previous_status: 'Active',
        new_status: 'Inactive',
        previous_balance: withdrawalAmount,
        final_balance: 0
      };

      // Add withdrawal info if applicable
      if (withdrawalAmount > 0) {
        responseData.withdrawal_amount = withdrawalAmount;
        responseData.withdrawal_transaction_id = withdrawalTransactionId;
        responseData.message += ` Full balance of LKR ${withdrawalAmount.toLocaleString()} withdrawn and account closed.`;
      } else {
        responseData.message += ' Account closed with zero balance.';
      }

      res.json(responseData);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error: ' + error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Function to automatically calculate AND credit savings interest
const processMonthlySavingsInterest = async () => {
  console.log('🚀 Starting automatic monthly savings interest processing...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    // Always process the previous month
    const periodStart = new Date(currentYear, today.getMonth() - 1, 1);
    const periodEnd = new Date(currentYear, today.getMonth(), 0);
    
    // Format dates as YYYY-MM-DD
    const startDate = periodStart.toISOString().split('T')[0];
    const endDate = periodEnd.toISOString().split('T')[0];
    const processDate = today.toISOString().split('T')[0];

    // Check if this MONTH has already been processed for savings interest
    const periodCheck = await client.query(`
      SELECT * FROM savings_interest_periods 
      WHERE EXTRACT(MONTH FROM period_start) = $1 
      AND EXTRACT(YEAR FROM period_start) = $2 
      AND is_processed = true
    `, [currentMonth, currentYear]);

    if (periodCheck.rows.length > 0) {
      console.log('✅ Savings interest for this month already processed');
      await client.query('ROLLBACK');
      return { alreadyProcessed: true, message: 'Savings interest for this month already processed' };
    }

    console.log(`📅 Processing savings interest for period: ${startDate} to ${endDate}`);

    // Get all active savings accounts with their interest rates
    const activeSavingsAccounts = await client.query(`
      SELECT 
        a.account_id,
        a.balance,
        sp.interest,
        sp.plan_type,
        sp.min_balance
      FROM account a
      JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id
      WHERE a.account_status = 'Active'
      AND a.balance >= sp.min_balance
      AND a.fd_id IS NULL  -- Exclude accounts with active FDs
    `);

    let calculatedCount = 0;
    let creditedCount = 0;
    let totalInterest = 0;

    // Calculate interest for each savings account and credit immediately
    for (const account of activeSavingsAccounts.rows) {
      // Check if this account already had interest calculated for current month
      const existingInterest = await client.query(`
        SELECT * FROM savings_interest_calculations 
        WHERE account_id = $1 
        AND EXTRACT(MONTH FROM calculation_date) = $2 
        AND EXTRACT(YEAR FROM calculation_date) = $3
        AND status = 'credited'
      `, [account.account_id, currentMonth, currentYear]);

      if (existingInterest.rows.length > 0) {
        console.log(`⏭️ Interest already credited for account ${account.account_id} this month, skipping`);
        continue;
      }

      // Calculate monthly interest (annual rate / 12)
      const monthlyInterestRate = parseFloat(account.interest) / 100 / 12;
      const interestAmount = parseFloat((parseFloat(account.balance) * monthlyInterestRate).toFixed(2));
      
      if (interestAmount > 0) {
        try {
          // Update account balance (CREDIT THE INTEREST)
          const newBalance = parseFloat(account.balance) + interestAmount;
          
          await client.query(
            'UPDATE account SET balance = $1 WHERE account_id = $2',
            [newBalance, account.account_id]
          );

          // Generate transaction ID for interest credit
          const transactionCount = await client.query('SELECT COUNT(*) as count FROM transaction');
          const transactionId = `TXN${String(parseInt(transactionCount.rows[0].count) + 1).padStart(3, '0')}`;

          // Create interest credit transaction
          const adminUser = await client.query(
            "SELECT employee_id FROM employee WHERE role = 'Admin' LIMIT 1"
          );
          const employeeId = adminUser.rows.length > 0 ? adminUser.rows[0].employee_id : 'A001';

          await client.query(
            `INSERT INTO transaction (transaction_id, transaction_type, amount, time, description, account_id, employee_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [transactionId, 'Interest', interestAmount, today,
             `Monthly Savings Interest - ${account.plan_type} Plan`, account.account_id, employeeId]
          );

          // Create interest calculation record (marked as credited)
          await client.query(
            `INSERT INTO savings_interest_calculations 
             (account_id, calculation_date, interest_amount, interest_rate, plan_type, status, credited_at)
             VALUES ($1, $2, $3, $4, $5, 'credited', $6)`,
            [account.account_id, processDate, interestAmount, account.interest, account.plan_type, today]
          );

          calculatedCount++;
          creditedCount++;
          totalInterest += interestAmount;

          console.log(`💰 Credited LKR ${interestAmount} interest for account ${account.account_id} (${account.plan_type})`);

        } catch (error) {
          console.error(`❌ Failed to process interest for account ${account.account_id}:`, error);
          // Create failed record but continue with others
          await client.query(
            `INSERT INTO savings_interest_calculations 
             (account_id, calculation_date, interest_amount, interest_rate, plan_type, status)
             VALUES ($1, $2, $3, $4, $5, 'failed')`,
            [account.account_id, processDate, interestAmount, account.interest, account.plan_type]
          );
        }
      }
    }

    // Mark period as processed (only if we actually processed something)
    if (calculatedCount > 0) {
      await client.query(
        `INSERT INTO savings_interest_periods (period_start, period_end, is_processed, processed_at)
         VALUES ($1, $2, true, $3)`,
        [startDate, endDate, processDate]
      );
    }

    await client.query('COMMIT');
    
    console.log(`✅ Monthly savings interest processing completed!`);
    console.log(`📊 Accounts Processed: ${calculatedCount}`);
    console.log(`💰 Total Interest Credited: LKR ${totalInterest.toLocaleString()}`);
    console.log(`📅 Period: ${startDate} to ${endDate}`);

    return {
      success: true,
      processed: calculatedCount,
      totalInterest: totalInterest,
      period: `${startDate} to ${endDate}`
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in automatic savings interest processing:', error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
};

// Schedule savings interest to run on 1st of every month at 3:30 AM (30 minutes after FD interest)
cron.schedule('30 3 1 * *', processMonthlySavingsInterest);
console.log('✅ Savings Interest Auto-Processor: Scheduled for 1st of every month at 3:30 AM');

// Manual trigger for savings interest processing
app.post('/api/admin/savings-interest/process-now', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    console.log('🔄 Manual savings interest processing triggered by admin');
    const result = await processMonthlySavingsInterest();
    
    if (result.alreadyProcessed) {
      return res.status(400).json({ 
        message: 'Savings interest for this month has already been processed',
        note: 'Interest can only be processed once per month to prevent double payments'
      });
    }
    
    if (result.success) {
      res.json({ 
        message: 'Savings interest processing completed successfully',
        processed_count: result.processed,
        total_interest: result.totalInterest,
        period: result.period,
        note: 'This process also runs automatically on the 1st of every month at 3:30 AM'
      });
    } else {
      res.status(500).json({ 
        message: 'Savings interest processing failed',
        error: result.error 
      });
    }

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Get savings interest summary
app.get('/api/admin/savings-interest/summary', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const client = await pool.connect();
    try {
      // Total interest paid this month
      const monthlyInterest = await client.query(`
        SELECT COALESCE(SUM(interest_amount), 0) as total_interest
        FROM savings_interest_calculations 
        WHERE status = 'credited' 
        AND EXTRACT(MONTH FROM credited_at) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM credited_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      `);

      // Active savings accounts count and total balance
      const activeSavingsAccounts = await client.query(`
        SELECT COUNT(*) as active_count, COALESCE(SUM(balance), 0) as total_balance
        FROM account 
        WHERE account_status = 'Active' 
        AND fd_id IS NULL
        AND balance >= (
          SELECT min_balance FROM savingplan sp 
          WHERE sp.saving_plan_id = account.saving_plan_id
        )
      `);

      // Recent interest periods
      const recentPeriods = await client.query(`
        SELECT period_start, period_end, processed_at
        FROM savings_interest_periods 
        WHERE is_processed = true
        ORDER BY processed_at DESC
        LIMIT 5
      `);

      res.json({
        monthly_interest: parseFloat(monthlyInterest.rows[0].total_interest),
        active_savings_accounts: {
          count: parseInt(activeSavingsAccounts.rows[0].active_count),
          total_balance: parseFloat(activeSavingsAccounts.rows[0].total_balance)
        },
        recent_periods: recentPeriods.rows,
        next_scheduled_run: '1st of next month at 3:30 AM'
      });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Agent-wise total number and value of transactions
app.get('/api/admin/reports/agent-transactions', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { startDate, endDate } = req.query;
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          e.employee_id,
          e.first_name || ' ' || e.last_name as employee_name,
          COUNT(t.transaction_id) as total_transactions,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'Deposit' THEN t.amount ELSE 0 END), 0) as total_deposits,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'Withdrawal' THEN t.amount ELSE 0 END), 0) as total_withdrawals,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'Deposit' THEN t.amount ELSE -t.amount END), 0) as net_value
        FROM employee e
        LEFT JOIN transaction t ON e.employee_id = t.employee_id
          AND DATE(t.time) BETWEEN $1 AND $2
        WHERE e.role IN ('Agent', 'Manager')
        GROUP BY e.employee_id, e.first_name, e.last_name
        ORDER BY total_transactions DESC
      `, [startDate, endDate]);

      res.json(result.rows);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Account-wise transaction summary and current balance
app.get('/api/admin/reports/account-summaries', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { startDate, endDate } = req.query;
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          a.account_id,
          STRING_AGG(DISTINCT c.first_name || ' ' || c.last_name, ', ') as customer_names,
          COUNT(t.transaction_id) as transaction_count,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'Deposit' THEN t.amount ELSE 0 END), 0) as total_deposits,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'Withdrawal' THEN t.amount ELSE 0 END), 0) as total_withdrawals,
          a.balance as current_balance
        FROM account a
        JOIN takes tk ON a.account_id = tk.account_id
        JOIN customer c ON tk.customer_id = c.customer_id
        LEFT JOIN transaction t ON a.account_id = t.account_id
          AND DATE(t.time) BETWEEN $1 AND $2
        WHERE a.account_status = 'Active'
        GROUP BY a.account_id, a.balance
        ORDER BY a.account_id
      `, [startDate, endDate]);

      res.json(result.rows);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// List of active FDs and their next interest payout dates
app.get('/api/admin/reports/active-fds', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
  }

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          fd.fd_id,
          a.account_id,
          STRING_AGG(DISTINCT c.first_name || ' ' || c.last_name, ', ') as customer_names,
          fd.fd_balance,
          fp.interest as interest_rate,
          fd.open_date,
          fd.maturity_date,
          fd.auto_renewal_status,
          CASE 
            WHEN DATE_PART('day', CURRENT_DATE) >= 1 THEN 
              DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            ELSE 
              DATE_TRUNC('month', CURRENT_DATE)
          END as next_interest_date
        FROM fixeddeposit fd
        JOIN fdplan fp ON fd.fd_plan_id = fp.fd_plan_id
        JOIN account a ON fd.fd_id = a.fd_id
        JOIN takes t ON a.account_id = t.account_id
        JOIN customer c ON t.customer_id = c.customer_id
        WHERE fd.fd_status = 'Active'
        GROUP BY fd.fd_id, a.account_id, fd.fd_balance, fp.interest, fd.open_date, fd.maturity_date, fd.auto_renewal_status
        ORDER BY fd.open_date DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Monthly interest distribution summary by account type
app.get('/api/admin/reports/interest-summary', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { month, year } = req.query;
    const client = await pool.connect();
    
    try {
      // FD Interest Summary
      const fdInterest = await client.query(`
        SELECT 
          'Fixed Deposit' as plan_type,
          fp.fd_options as account_type,
          COALESCE(SUM(fic.interest_amount), 0) as total_interest,
          COUNT(DISTINCT fic.fd_id) as account_count,
          COALESCE(ROUND(AVG(fic.interest_amount), 2), 0) as average_interest
        FROM fd_interest_calculations fic
        JOIN fixeddeposit fd ON fic.fd_id = fd.fd_id
        JOIN fdplan fp ON fd.fd_plan_id = fp.fd_plan_id
        WHERE fic.status = 'credited'
          AND EXTRACT(MONTH FROM fic.credited_at) = $1
          AND EXTRACT(YEAR FROM fic.credited_at) = $2
        GROUP BY fp.fd_options
      `, [month, year]);

      // Savings Interest Summary
      const savingsInterest = await client.query(`
        SELECT 
          'Savings' as plan_type,
          sic.plan_type as account_type,
          COALESCE(SUM(sic.interest_amount), 0) as total_interest,
          COUNT(DISTINCT sic.account_id) as account_count,
          COALESCE(ROUND(AVG(sic.interest_amount), 2), 0) as average_interest
        FROM savings_interest_calculations sic
        WHERE sic.status = 'credited'
          AND EXTRACT(MONTH FROM sic.credited_at) = $1
          AND EXTRACT(YEAR FROM sic.credited_at) = $2
        GROUP BY sic.plan_type
      `, [month, year]);

      const combinedResults = [...fdInterest.rows, ...savingsInterest.rows];
      res.json(combinedResults);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Customer activity report
app.get('/api/admin/reports/customer-activity', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    if (decoded.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { startDate, endDate } = req.query;
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          c.customer_id,
          c.first_name || ' ' || c.last_name as customer_name,
          COUNT(DISTINCT t.account_id) as account_count,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'Deposit' THEN t.amount ELSE 0 END), 0) as total_deposits,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'Withdrawal' THEN t.amount ELSE 0 END), 0) as total_withdrawals,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'Deposit' THEN t.amount ELSE -t.amount END), 0) as net_balance,
          MAX(t.time) as last_activity
        FROM customer c
        JOIN takes tk ON c.customer_id = tk.customer_id
        JOIN account a ON tk.account_id = a.account_id
        LEFT JOIN transaction t ON a.account_id = t.account_id
          AND DATE(t.time) BETWEEN $1 AND $2
        GROUP BY c.customer_id, c.first_name, c.last_name
        ORDER BY net_balance DESC
      `, [startDate, endDate]);

      res.json(result.rows);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Database error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});