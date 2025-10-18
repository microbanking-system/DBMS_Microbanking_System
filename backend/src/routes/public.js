const router = require('express').Router();
const { pool } = require('../db');

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Get all saving plans
router.get('/saving-plans', async (req, res) => {
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
router.get('/branches', async (req, res) => {
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

// FD plans
router.get('/fd-plans', async (req, res) => {
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

module.exports = router;
