// routes/credits.js
const express  = require('express');
const { Pool } = require('pg');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

function requireResellerOrAdmin(req, res, next) {
  if (!['admin', 'reseller'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

// ----------------------------------------------------------------
// GET /api/credits/balance
// ----------------------------------------------------------------
router.get('/balance', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const result = await pool.query(
      'SELECT credits_remaining, plan_type FROM users WHERE id = $1', [req.user.id]
    );
    if (!result.rows.length) return res.json({ credits_remaining: 0 });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    await pool.end();
  }
});

// ----------------------------------------------------------------
// POST /api/credits/add — admin o reseller añade créditos
// ----------------------------------------------------------------
router.post('/add', authenticateToken, requireResellerOrAdmin, async (req, res) => {
  const { user_id, credits } = req.body;
  if (!user_id || !credits || credits < 1) return res.status(400).json({ error: 'user_id y credits requeridos' });

  const pool = getPool();
  try {
    const user = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [user_id]);
    if (!user.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    await pool.query(
      'UPDATE users SET credits_remaining = credits_remaining + $1 WHERE id = $2',
      [credits, user_id]
    );

    const updated = await pool.query('SELECT credits_remaining FROM users WHERE id = $1', [user_id]);
    res.json({ message: `✅ ${credits} créditos añadidos a ${user.rows[0].name || user.rows[0].email}`, credits: updated.rows[0] });

  } catch (err) {
    console.error('Add credits error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    await pool.end();
  }
});

// ----------------------------------------------------------------
// GET /api/credits/history
// ----------------------------------------------------------------
router.get('/history', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, plan, credits, amount, created_at
       FROM payments WHERE email = (SELECT email FROM users WHERE id = $1)
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    await pool.end();
  }
});

// ----------------------------------------------------------------
// GET /api/credits/plans
// ----------------------------------------------------------------
router.get('/plans', async (req, res) => {
  const plans = [
    { name: 'Starter', credits: 10,  price_eur: 249,  description: '10 campañas profesionales' },
    { name: 'Pro',     credits: 30,  price_eur: 590,  description: '30 campañas profesionales' },
    { name: 'Agency',  credits: 100, price_eur: 1490, description: '100 campañas profesionales' }
  ];
  res.json(plans);
});

module.exports = router;
