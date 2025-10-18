const router = require('express').Router();
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// All agent routes require authentication and Agent/Admin role
router.use(authenticate, requireRole('Agent', 'Admin'));

// Process transaction
router.post('/transactions/process', async (req, res) => {
  const { account_id, transaction_type, amount, description } = req.body;
  if (!account_id || !transaction_type || amount === undefined || !description) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  if (amount <= 0) return res.status(400).json({ message: 'Amount must be positive' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.actor_employee_id', $1, true)", [String(req.user.id)]);
    const accountResult = await client.query(
      'SELECT * FROM account WHERE account_id = $1 AND account_status = $2',
      [account_id, 'Active']
    );
    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Account not found or closed' });
    }
    const transactionResult = await client.query(
      'SELECT create_transaction_with_validation($1, $2, $3, $4, $5) as transaction_id',
      [transaction_type, amount, description, account_id, req.user.id]
    );
    const balanceResult = await client.query('SELECT balance FROM account WHERE account_id = $1', [account_id]);
    await client.query('COMMIT');
    res.status(201).json({
      message: 'Transaction processed successfully',
      transaction_id: transactionResult.rows[0].transaction_id,
      new_balance: parseFloat(balanceResult.rows[0].balance),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    if (error.message.includes('Insufficient balance') || error.message.includes('Minimum balance required')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Database error: ' + error.message });
  } finally {
    client.release();
  }
});

// Accounts list for transactions
router.get('/accounts', async (req, res) => {
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
});

router.get('/transactions/recent', async (req, res) => {
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
});

// Accounts with FD info
router.get('/accounts-with-fd', async (req, res) => {
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
});

// Fixed deposits list
router.get('/fixed-deposits', async (req, res) => {
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
        STRING_AGG(DISTINCT c.first_name || ' ' || c.last_name, ', ') as customer_names,
        STRING_AGG(DISTINCT c.nic, ',') as customer_nics
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
});

// Search FDs
router.get('/fixed-deposits/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ message: 'Search query is required' });
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
        STRING_AGG(DISTINCT c.first_name || ' ' || c.last_name, ', ') as customer_names,
        STRING_AGG(DISTINCT c.nic, ',') as customer_nics
      FROM fixeddeposit fd
      JOIN fdplan fp ON fd.fd_plan_id = fp.fd_plan_id
      JOIN account a ON fd.fd_id = a.fd_id
      JOIN takes t ON a.account_id = t.account_id
      JOIN customer c ON t.customer_id = c.customer_id
      WHERE 
        CAST(fd.fd_id AS TEXT) ILIKE $1 OR 
        c.nic ILIKE $1
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
});

// Create FD
router.post('/fixed-deposits/create', async (req, res) => {
  const { customer_id, account_id, fd_plan_id, principal_amount, auto_renewal_status } = req.body;
  if (!customer_id || !account_id || !fd_plan_id || principal_amount === undefined) {
    return res.status(400).json({ message: 'All required fields must be provided' });
  }
  if (principal_amount <= 0) return res.status(400).json({ message: 'Principal amount must be greater than 0' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
    const accountResult = await client.query(
      `SELECT a.*, sp.min_balance, sp.plan_type 
       FROM account a 
       JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id 
       WHERE a.account_id = $1 AND a.account_status = $2`,
      [account_id, 'Active']
    );
    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Account not found or closed' });
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
    const planResult = await client.query('SELECT * FROM fdplan WHERE fd_plan_id = $1', [fd_plan_id]);
    if (planResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid FD plan' });
    }
    const fdPlan = planResult.rows[0];
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
    const fdResult = await client.query(
      `INSERT INTO fixeddeposit (fd_balance, auto_renewal_status, fd_status, open_date, maturity_date, fd_plan_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING fd_id`,
      [principal_amount, auto_renewal_status, 'Active', openDate, maturityDate, fd_plan_id]
    );
    const fdId = fdResult.rows[0].fd_id;
    await client.query(
      'SELECT create_transaction_with_validation($1, $2, $3, $4, $5)',
      ['Withdrawal', principal_amount, `Fixed Deposit Creation - ${fdPlan.fd_options} Plan`, account_id, req.user.id]
    );
    await client.query('UPDATE account SET fd_id = $1 WHERE account_id = $2', [fdId, account_id]);
    const updatedAccount = await client.query('SELECT balance FROM account WHERE account_id = $1', [account_id]);
    await client.query('COMMIT');
    res.status(201).json({
      message: 'Fixed Deposit created successfully',
      fd_id: fdId,
      maturity_date: maturityDate.toISOString().split('T')[0],
      new_savings_balance: parseFloat(updatedAccount.rows[0].balance),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error: ' + error.message });
  } finally {
    client.release();
  }
});

// Deactivate FD
router.post('/fixed-deposits/deactivate', async (req, res) => {
  const { fd_id } = req.body;
  if (!fd_id) return res.status(400).json({ message: 'FD ID is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fdResult = await client.query('SELECT * FROM fixeddeposit WHERE fd_id = $1 AND fd_status = $2', [fd_id, 'Active']);
    if (fdResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Active fixed deposit not found' });
    }
    const fd = fdResult.rows[0];
    const accountResult = await client.query('SELECT account_id FROM account WHERE fd_id = $1', [fd_id]);
    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Linked savings account not found' });
    }
    const accountId = accountResult.rows[0].account_id;
    await client.query('SELECT create_transaction_with_validation($1, $2, $3, $4, $5)', [
      'Deposit', fd.fd_balance, `FD Deactivation - Principal Return (${fd_id})`, accountId, req.user.id,
    ]);
    await client.query('UPDATE fixeddeposit SET fd_status = $1 WHERE fd_id = $2', ['Closed', fd_id]);
    await client.query('UPDATE account SET fd_id = NULL WHERE fd_id = $1', [fd_id]);
    await client.query('COMMIT');
    res.json({ message: 'Fixed deposit deactivated successfully. Principal amount returned to savings account.', fd_id, principal_returned: fd.fd_balance, account_id: accountId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error: ' + error.message });
  } finally {
    client.release();
  }
});

// Account creation
router.post('/accounts/create', async (req, res) => {
  const { customer_id, saving_plan_id, initial_deposit, branch_id, joint_holders = [] } = req.body;
  const customerIdNum = Number(customer_id);
  const savingPlanIdNum = Number(saving_plan_id);
  const branchIdNum = Number(branch_id);
  const initialDeposit = Number(initial_deposit);
  if (!customerIdNum || !savingPlanIdNum || !branchIdNum || initial_deposit === undefined) {
    return res.status(400).json({ message: 'All required fields must be provided' });
  }
  if (isNaN(initialDeposit)) return res.status(400).json({ message: 'Invalid initial deposit amount' });
  if (initialDeposit < 0) return res.status(400).json({ message: 'Initial deposit cannot be negative' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const planResult = await client.query('SELECT * FROM savingplan WHERE saving_plan_id = $1', [savingPlanIdNum]);
    if (planResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid saving plan' });
    }
    const savingPlan = planResult.rows[0];
    if (savingPlan.plan_type === 'Joint' && joint_holders.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Joint account requires at least one joint holder' });
    }
    if (initialDeposit < savingPlan.min_balance) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Minimum deposit for ${savingPlan.plan_type} plan is LKR ${savingPlan.min_balance}` });
    }
    const customerResult = await client.query('SELECT *, EXTRACT(YEAR FROM AGE(date_of_birth)) as age FROM customer WHERE customer_id = $1', [customerIdNum]);
    if (customerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Primary customer not found' });
    }
    const primaryCustomer = customerResult.rows[0];
    const planType = savingPlan.plan_type;
    let requiredAge = 18;
    if (planType === 'Senior') requiredAge = 60;
    else if (planType === 'Joint') requiredAge = 18;
    else if (planType === 'Children') requiredAge = 0;
    else if (planType === 'Teen') requiredAge = 12;
    else if (planType === 'Adult') requiredAge = 18;
    if (parseInt(primaryCustomer.age) < requiredAge) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `${planType} account requires account holder to be at least ${requiredAge} years old` });
    }
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
      const underageJointHolder = jointHoldersResult.rows.find((holder) => parseInt(holder.age) < 18);
      if (underageJointHolder) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Joint holder ${underageJointHolder.first_name} ${underageJointHolder.last_name} must be at least 18 years old` });
      }
    }
    const branchResult = await client.query('SELECT * FROM branch WHERE branch_id = $1', [branch_id]);
    if (branchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Branch not found' });
    }
    const accountResult = await client.query(
      `INSERT INTO account (open_date, account_status, balance, saving_plan_id, branch_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING account_id`,
      [new Date().toISOString().split('T')[0], 'Active', 0, savingPlanIdNum, branchIdNum]
    );
    const accountId = accountResult.rows[0].account_id;
    await client.query(`INSERT INTO takes (customer_id, account_id) VALUES ($1, $2)`, [customerIdNum, accountId]);
    for (const jointCustomerId of joint_holders) {
      await client.query(`INSERT INTO takes (customer_id, account_id) VALUES ($1, $2)`, [jointCustomerId, accountId]);
    }
    if (initialDeposit > 0) {
      await client.query('SELECT create_transaction_with_validation($1, $2, $3, $4, $5)', ['Deposit', initialDeposit, 'Initial Deposit', accountId, req.user.id]);
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Account created successfully', account_id: accountId, joint_holders_count: joint_holders.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error: ' + error.message });
  } finally {
    client.release();
  }
});

// All accounts with info
router.get('/all-accounts', async (req, res) => {
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
        STRING_AGG(DISTINCT c.nic, ',') as customer_nics,
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
});

// Account details
router.get('/accounts/:accountId/details', async (req, res) => {
  const { accountId } = req.params;
  const client = await pool.connect();
  try {
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
    if (accountResult.rows.length === 0) return res.status(404).json({ message: 'Account not found' });
    const customersResult = await client.query(`
      SELECT c.customer_id, c.first_name, c.last_name, c.nic, c.date_of_birth
      FROM customer c
      JOIN takes t ON c.customer_id = t.customer_id
      WHERE t.account_id = $1
    `, [accountId]);
    const transactionsResult = await client.query(`
      SELECT transaction_id, transaction_type, amount, time, description
      FROM transaction 
      WHERE account_id = $1
      ORDER BY time DESC
      LIMIT 20
    `, [accountId]);
    res.json({ account: { ...accountResult.rows[0], customers: customersResult.rows, transactions: transactionsResult.rows } });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Search accounts
router.get('/accounts/search/:searchTerm', async (req, res) => {
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
});

// Change plan
router.post('/accounts/change-plan', async (req, res) => {
  const { account_id, new_saving_plan_id, reason, new_nic } = req.body || {};
  if (!account_id || !new_saving_plan_id || typeof reason !== 'string' || reason.trim().length === 0) {
    return res.status(400).json({ message: 'account_id, new_saving_plan_id and non-empty reason are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.actor_employee_id', $1, true)", [String(req.user.id)]);
    await client.query('SELECT change_account_saving_plan($1, $2, $3, $4, $5)', [
      Number(account_id),
      Number(new_saving_plan_id),
      Number(req.user.id),
      reason,
      new_nic ?? null,
    ]);
    const planInfo = await client.query('SELECT saving_plan_id, plan_type, interest, min_balance FROM savingplan WHERE saving_plan_id = $1', [Number(new_saving_plan_id)]);
    await client.query('COMMIT');
    res.json({ message: 'Plan changed successfully', new_plan: planInfo.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Change plan error:', error);
    return res.status(400).json({ message: error.message || 'Failed to change plan' });
  } finally {
    client.release();
  }
});

// Deactivate account
router.post('/accounts/deactivate', async (req, res) => {
  const { account_id, reason } = req.body;
  if (!account_id) return res.status(400).json({ message: 'Account ID is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const accountResult = await client.query('SELECT * FROM account WHERE account_id = $1 AND account_status = $2', [account_id, 'Active']);
    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Active account not found' });
    }
    const account = accountResult.rows[0];
    if (account.fd_id) {
      const fdResult = await client.query('SELECT * FROM fixeddeposit WHERE fd_id = $1 AND fd_status = $2', [account.fd_id, 'Active']);
      if (fdResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Cannot deactivate account with active Fixed Deposit. Please deactivate the FD first.' });
      }
    }
    let withdrawalAmount = parseFloat(account.balance);
    let withdrawalTransactionId = null;
    if (withdrawalAmount > 0) {
      await client.query("SELECT set_config('app.balance_update_allowed','true', true)");
      await client.query("SELECT set_config('app.balance_update_account_id', $1, true)", [String(account_id)]);
      await client.query('UPDATE account SET balance = $1 WHERE account_id = $2', [0, account_id]);
      const txResult = await client.query(
        `INSERT INTO transaction (transaction_type, amount, time, description, account_id, employee_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING transaction_id`,
        ['Withdrawal', withdrawalAmount, new Date(), `Account Closure - Full Balance Withdrawal - ${reason || 'No reason provided'}`, account_id, req.user.id]
      );
      withdrawalTransactionId = txResult.rows[0].transaction_id;
    }
    await client.query('UPDATE account SET account_status = $1, closed_at = $2 WHERE account_id = $3', ['Closed', new Date(), account_id]);
    await client.query('COMMIT');
    const responseData = {
      message: 'Account deactivated successfully',
      account_id,
      previous_status: 'Active',
      new_status: 'Closed',
      previous_balance: withdrawalAmount,
      final_balance: 0,
    };
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
});

// Customers basic list
router.get('/customers', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT customer_id, first_name, last_name, nic, date_of_birth FROM customer ORDER BY first_name, last_name');
    res.json({ customers: result.rows });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Customer register
router.post('/customers/register', async (req, res) => {
  const { first_name, last_name, nic, gender, date_of_birth, contact_no_1, contact_no_2, address, email } = req.body;
  if (!first_name || !last_name || !nic || !gender || !date_of_birth || !contact_no_1 || !address || !email) {
    return res.status(400).json({ message: 'All required fields must be provided' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customerCheck = await client.query('SELECT 1 FROM customer WHERE nic = $1', [nic]);
    if (customerCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Customer with this NIC already exists' });
    }
    const contactResult = await client.query(
      `INSERT INTO contact (type, contact_no_1, contact_no_2, address, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING contact_id`,
      ['customer', contact_no_1, contact_no_2 || null, address, email]
    );
    const contactId = contactResult.rows[0].contact_id;
    const customerResult = await client.query(
      `INSERT INTO customer (first_name, last_name, gender, nic, date_of_birth, contact_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING customer_id`,
      [first_name, last_name, gender, nic, date_of_birth, contactId]
    );
    await client.query('COMMIT');
    res.status(201).json({ message: 'Customer registered successfully', customer_id: customerResult.rows[0].customer_id });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Customer details
router.get('/customers/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        c.customer_id,
        c.first_name,
        c.last_name,
        c.gender,
        c.nic,
        c.date_of_birth,
        ct.contact_id,
        ct.contact_no_1,
        ct.contact_no_2,
        ct.address,
        ct.email
      FROM customer c
      JOIN contact ct ON c.contact_id = ct.contact_id
      WHERE c.customer_id = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json({ customer: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

// Update customer
router.put('/customers/:id', async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, nic, gender, date_of_birth, contact_no_1, contact_no_2, address, email } = req.body;
  if (!first_name || !last_name || !nic || !gender || !date_of_birth || !contact_no_1 || !address || !email) {
    return res.status(400).json({ message: 'All required fields must be provided' });
  }
  const dob = new Date(date_of_birth);
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  if (age < 18) {
    return res.status(400).json({ message: 'Customer must be at least 18 years old' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT customer_id, contact_id, nic FROM customer WHERE customer_id = $1', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Customer not found' });
    }
    const { contact_id, nic: currentNic } = existing.rows[0];
    if (nic !== currentNic) {
      const nicCheck = await client.query('SELECT 1 FROM customer WHERE nic = $1 AND customer_id <> $2', [nic, id]);
      if (nicCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Another customer with this NIC already exists' });
      }
    }
    await client.query(
      `UPDATE contact SET contact_no_1 = $1, contact_no_2 = $2, address = $3, email = $4 WHERE contact_id = $5`,
      [contact_no_1, contact_no_2 || null, address, email, contact_id]
    );
    await client.query(
      `UPDATE customer SET first_name = $1, last_name = $2, gender = $3, nic = $4, date_of_birth = $5 WHERE customer_id = $6`,
      [first_name, last_name, gender, nic, date_of_birth, id]
    );
    await client.query('COMMIT');
    res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error: ' + error.message });
  } finally {
    client.release();
  }
});

// Update only contact
router.put('/customers/:id/contact', async (req, res) => {
  const { id } = req.params;
  const { contact_no_1, contact_no_2, address, email } = req.body;
  if (!contact_no_1 || !address || !email) {
    return res.status(400).json({ message: 'contact_no_1, address and email are required' });
  }
  if (!/^[0-9+]{10,15}$/.test(String(contact_no_1))) {
    return res.status(400).json({ message: 'Invalid primary contact number' });
  }
  if (contact_no_2 && !/^[0-9+]{10,15}$/.test(String(contact_no_2))) {
    return res.status(400).json({ message: 'Invalid secondary contact number' });
  }
  if (!/\S+@\S+\.\S+/.test(String(email))) {
    return res.status(400).json({ message: 'Invalid email address' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.actor_employee_id', $1, true)", [String(req.user.id)]);
    const existing = await client.query('SELECT contact_id FROM customer WHERE customer_id = $1', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Customer not found' });
    }
    const { contact_id } = existing.rows[0];
    await client.query(
      `UPDATE contact SET contact_no_1 = $1, contact_no_2 = $2, address = $3, email = $4 WHERE contact_id = $5`,
      [contact_no_1, contact_no_2 || null, address, email, contact_id]
    );
    await client.query('COMMIT');
    res.json({ message: 'Contact details updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error: ' + error.message });
  } finally {
    client.release();
  }
});

// Agent performance
router.get('/performance', async (req, res) => {
  const client = await pool.connect();
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const todayTransactionsResult = await client.query(
      `SELECT COUNT(*) as count FROM transaction 
       WHERE employee_id = $1 AND DATE(time) = $2`,
      [employeeId, today]
    );
    const totalCustomersResult = await client.query(
      `SELECT COUNT(DISTINCT t.customer_id) as count 
       FROM takes t
       JOIN account a ON t.account_id = a.account_id
       JOIN transaction tr ON a.account_id = tr.account_id
       WHERE tr.employee_id = $1 AND tr.transaction_type = 'Deposit'`,
      [employeeId]
    );
    const monthlyAccountsResult = await client.query(
      `SELECT COUNT(DISTINCT a.account_id) as count 
       FROM account a
       JOIN transaction tr ON a.account_id = tr.account_id
       WHERE tr.employee_id = $1 AND EXTRACT(MONTH FROM tr.time) = $2 
       AND EXTRACT(YEAR FROM tr.time) = $3`,
      [employeeId, currentMonth, currentYear]
    );
    const transactionVolumeResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM transaction 
       WHERE employee_id = $1`,
      [employeeId]
    );
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
      recent_activity: recentActivityResult.rows,
    };
    res.json(performanceData);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  } finally {
    client.release();
  }
});

module.exports = router;
