const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool } = require('./db');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const agentRoutes = require('./routes/agent');
const managerRoutes = require('./routes/manager');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health (kept here for quick readiness)
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ message: 'Server and database are running', status: 'OK', database_time: result.rows[0].current_time });
  } catch (error) {
    res.status(500).json({ message: 'Database connection failed', status: 'ERROR' });
  }
});

// Routers
app.use('/api', publicRoutes);
app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/manager', managerRoutes);

module.exports = app;
