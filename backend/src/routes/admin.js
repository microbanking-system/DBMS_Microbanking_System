const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// All admin routes require auth and Admin role
router.use(authenticate, requireRole('Admin'));

// Refresh materialized views
router.post('/refresh-views', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('SELECT refresh_materialized_views()');
    res.json({ message: 'Materialized views refreshed successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Register employee (admin-only)
router.post('/register', async (req, res) => {
  const { role, username, password, first_name, last_name, nic, gender, date_of_birth, branch_id, contact_no_1, contact_no_2, address, email } = req.body;
  if (!username || !password || !first_name || !last_name || !nic || !gender || !date_of_birth || !branch_id) {
    return res.status(400).json({ message: 'All basic fields are required' });
  }
  if (!contact_no_1 || !address || !email) {
    return res.status(400).json({ message: 'All contact fields are required' });
  }
  try {
    const dob = new Date(date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    if (age < 18) return res.status(400).json({ message: 'Employee must be at least 18 years old' });
  } catch {
    return res.status(400).json({ message: 'Invalid date_of_birth' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query('SELECT 1 FROM employee WHERE username = $1', [username]);
    if (userResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Username already exists' });
    }
    const contactResult = await client.query(
      `INSERT INTO contact (type, contact_no_1, contact_no_2, address, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING contact_id`,
      ['employee', contact_no_1, contact_no_2 || null, address, email]
    );
    const contact_id = contactResult.rows[0].contact_id;
    const hashedPassword = await bcrypt.hash(password, 10);
    const insertResult = await client.query(
      `INSERT INTO employee (role, username, password, first_name, last_name, nic, gender, date_of_birth, branch_id, contact_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING employee_id`,
      [role, username, hashedPassword, first_name, last_name, nic, gender, date_of_birth, branch_id, contact_id]
    );
    await client.query('COMMIT');
    res.status(201).json({ message: 'User created successfully', employee_id: insertResult.rows[0].employee_id, contact_id });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error: ' + error.message });
  } finally {
    client.release();
  }
});

// List users
router.get('/users', async (req, res) => {
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
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM employee WHERE employee_id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Branches list
router.get('/branches', async (req, res) => {
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
});

// Create branch
router.post('/branches', async (req, res) => {
  // Frontend sends: { name, contact_no_1, contact_no_2?, address, email }
  const { name, contact_no_1, contact_no_2, address, email } = req.body || {};

  if (!name || !contact_no_1 || !address || !email) {
    return res.status(400).json({ message: 'All required fields must be provided' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create contact
    const contactResult = await client.query(
      `INSERT INTO contact (type, contact_no_1, contact_no_2, address, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING contact_id`,
      ['branch', contact_no_1, contact_no_2 || null, address, email]
    );
    const contactId = contactResult.rows[0].contact_id;

    // Create branch (auto-generated branch_id)
    const branchResult = await client.query(
      `INSERT INTO branch (name, contact_id)
       VALUES ($1, $2)
       RETURNING branch_id`,
      [name, contactId]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Branch created successfully',
      branch_id: branchResult.rows[0].branch_id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Delete branch
router.delete('/branches/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const branchResult = await client.query('SELECT contact_id FROM branch WHERE branch_id = $1', [id]);
    if (branchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Branch not found' });
    }
    const contactId = branchResult.rows[0].contact_id;
    const employeesCheck = await client.query('SELECT COUNT(*) as count FROM employee WHERE branch_id = $1', [id]);
    if (parseInt(employeesCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cannot delete branch with assigned employees. Reassign employees first.' });
    }
    const accountsCheck = await client.query('SELECT COUNT(*) as count FROM account WHERE branch_id = $1', [id]);
    if (parseInt(accountsCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cannot delete branch with associated accounts. Transfer accounts first.' });
    }
    await client.query('DELETE FROM branch WHERE branch_id = $1', [id]);
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
});

// Interest summaries
router.get('/fd-interest/summary', async (req, res) => {
  const client = await pool.connect();
  try {
    const monthlyInterest = await client.query(`
      SELECT COALESCE(SUM(interest_amount), 0) as total_interest
      FROM fd_interest_calculations 
      WHERE status = 'credited' 
      AND EXTRACT(MONTH FROM credited_at) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM credited_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);
    const activeFDs = await client.query(`
      SELECT COUNT(*) as active_count, COALESCE(SUM(fd_balance), 0) as total_value
      FROM fixeddeposit 
      WHERE fd_status = 'Active'
    `);
    const recentPeriods = await client.query(`
      SELECT 
        credited_at::date AS period_start,
        credited_at::date AS period_end,
        MAX(credited_at) AS processed_at
      FROM fd_interest_calculations 
      WHERE status = 'credited'
      GROUP BY credited_at::date
      ORDER BY credited_at::date DESC
      LIMIT 5
    `);
    res.json({
      monthly_interest: parseFloat(monthlyInterest.rows[0].total_interest),
      active_fds: {
        count: parseInt(activeFDs.rows[0].active_count),
        total_value: parseFloat(activeFDs.rows[0].total_value),
      },
      recent_periods: recentPeriods.rows,
      next_scheduled_run: 'Daily at 3:00 AM',
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

router.get('/savings-interest/summary', async (req, res) => {
  const client = await pool.connect();
  try {
    const monthlyInterest = await client.query(`
      SELECT COALESCE(SUM(interest_amount), 0) as total_interest
      FROM savings_interest_calculations 
      WHERE status = 'credited' 
      AND EXTRACT(MONTH FROM credited_at) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM credited_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);
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
    const recentPeriods = await client.query(`
      SELECT 
        credited_at::date AS period_start,
        credited_at::date AS period_end,
        MAX(credited_at) AS processed_at
      FROM savings_interest_calculations 
      WHERE status = 'credited'
      GROUP BY credited_at::date
      ORDER BY credited_at::date DESC
      LIMIT 5
    `);
    res.json({
      monthly_interest: parseFloat(monthlyInterest.rows[0].total_interest),
      active_savings_accounts: {
        count: parseInt(activeSavingsAccounts.rows[0].active_count),
        total_balance: parseFloat(activeSavingsAccounts.rows[0].total_balance),
      },
      recent_periods: recentPeriods.rows,
      next_scheduled_run: 'Daily at 3:30 AM',
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Reports
router.get('/reports/agent-transactions', async (req, res) => {
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
      WHERE e.role = 'Agent'
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
});

router.get('/reports/account-summaries', async (req, res) => {
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
});

router.get('/reports/active-fds', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      WITH last_credited AS (
        SELECT fd_id, MAX(calculation_date) AS last_date
        FROM fd_interest_calculations
        WHERE status = 'credited'
        GROUP BY fd_id
      )
      SELECT 
        fd.fd_id,
        a.account_id,
        STRING_AGG(DISTINCT c.first_name || ' ' || c.last_name, ', ') as customer_names,
        fd.fd_balance,
        fp.interest as interest_rate,
        fd.open_date,
        fd.maturity_date,
        fd.auto_renewal_status,
        (COALESCE(l.last_date, fd.open_date) + INTERVAL '30 days')::date AS next_interest_date
      FROM fixeddeposit fd
      JOIN fdplan fp ON fd.fd_plan_id = fp.fd_plan_id
      JOIN account a ON fd.fd_id = a.fd_id
      JOIN takes t ON a.account_id = t.account_id
      JOIN customer c ON t.customer_id = c.customer_id
      LEFT JOIN last_credited l ON l.fd_id = fd.fd_id
      WHERE fd.fd_status = 'Active'
      GROUP BY fd.fd_id, a.account_id, fd.fd_balance, fp.interest, fd.open_date, fd.maturity_date, fd.auto_renewal_status, l.last_date
      ORDER BY fd.open_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

router.get('/reports/interest-summary', async (req, res) => {
  const { month, year } = req.query;
  const client = await pool.connect();
  try {
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
});

// Customer activity report
router.get('/reports/customer-activity', async (req, res) => {
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
});

module.exports = router;
