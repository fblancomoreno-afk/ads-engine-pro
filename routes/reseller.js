// routes/reseller.js  — Día 4
// Rutas que usa el panel del reseller
// Añadir en server.js:
//   const resellerRoutes = require('./routes/reseller');
//   app.use('/api/admin', resellerRoutes);

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const authenticateToken = require('../middleware/auth');
const { Pool } = require('pg');

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

// Middleware: solo reseller o admin pueden usar estas rutas
function requireResellerOrAdmin(req, res, next) {
  if (req.user.role !== 'reseller' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

// ----------------------------------------------------------------
// GET /api/admin/reseller/clients
// Devuelve todos los clientes del reseller + estadísticas
// ----------------------------------------------------------------
router.get('/reseller/clients', authenticateToken, requireResellerOrAdmin, async (req, res) => {
  const pool = getPool();
  try {
    // Clientes asignados a este reseller
    const clientsResult = await pool.query(
      `SELECT id, email, plan_type, credits_remaining, created_at
       FROM users
       WHERE reseller_id = $1 AND role = 'customer'
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    const clients = clientsResult.rows;

    // Total campañas generadas por todos sus clientes
    const campaignsResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM campaigns c
       JOIN users u ON u.id = c.user_id
       WHERE u.reseller_id = $1`,
      [req.user.id]
    );

    // Total créditos vendidos (suma de créditos de todos los planes asignados)
    const creditsResult = await pool.query(
      `SELECT COALESCE(SUM(
         CASE plan_type
           WHEN 'starter' THEN 10
           WHEN 'pro'     THEN 30
           WHEN 'agency'  THEN 100
           ELSE 0
         END
       ), 0) as total
       FROM users
       WHERE reseller_id = $1 AND role = 'customer'`,
      [req.user.id]
    );

    return res.json({
      clients,
      total_clients:      clients.length,
      total_campaigns:    parseInt(campaignsResult.rows[0].total),
      total_credits_sold: parseInt(creditsResult.rows[0].total)
    });

  } catch (err) {
    console.error('Reseller clients error:', err);
    return res.status(500).json({ error: 'Error al obtener clientes' });
  } finally {
    await pool.end();
  }
});

// ----------------------------------------------------------------
// POST /api/admin/credits/add
// El reseller añade créditos a uno de sus clientes
// ----------------------------------------------------------------
router.post('/credits/add', authenticateToken, requireResellerOrAdmin, async (req, res) => {
  const { user_id, credits } = req.body;
  const pool = getPool();

  if (!user_id || !credits || credits < 1) {
    return res.status(400).json({ error: 'Datos incorrectos' });
  }

  try {
    // Verificar que el cliente pertenece a este reseller (seguridad)
    const check = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND reseller_id = $2`,
      [user_id, req.user.id]
    );

    // Admin puede añadir a cualquier cliente
    if (check.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Este cliente no es tuyo' });
    }

    await pool.query(
      `UPDATE users SET credits_remaining = credits_remaining + $1 WHERE id = $2`,
      [credits, user_id]
    );

    return res.json({ success: true, added: credits });

  } catch (err) {
    console.error('Add credits error:', err);
    return res.status(500).json({ error: 'Error al añadir créditos' });
  } finally {
    await pool.end();
  }
});

// ----------------------------------------------------------------
// POST /api/admin/users/create
// El reseller crea un nuevo cliente
// ----------------------------------------------------------------
router.post('/users/create', authenticateToken, requireResellerOrAdmin, async (req, res) => {
  const { email, password, plan_type } = req.body;
  const pool = getPool();

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email y contraseña requeridos (mín. 8 caracteres)' });
  }

  const PLAN_CREDITS = { starter: 10, pro: 30, agency: 100 };
  const credits = PLAN_CREDITS[plan_type] || 10;

  try {
    // Verificar que el email no existe ya
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Este email ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (email, password_hash, role, plan_type, credits_remaining, reseller_id, created_at)
       VALUES ($1, $2, 'customer', $3, $4, $5, NOW())`,
      [email, hash, plan_type || 'starter', credits, req.user.id]
    );

    return res.json({ success: true, email, plan_type, credits });

  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Error al crear cliente' });
  } finally {
    await pool.end();
  }
});

module.exports = router;
