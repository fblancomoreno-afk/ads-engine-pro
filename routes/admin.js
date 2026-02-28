// routes/admin.js  — Día 5
// Rutas exclusivas del panel de admin (Francisco)
// Añadir en server.js:
//   const adminRoutes = require('./routes/admin');
//   app.use('/api/admin', adminRoutes);
//
// NOTA: Este archivo convive con reseller.js — ambos usan /api/admin
// pero tienen rutas diferentes. No hay conflicto.

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

// Solo admin puede usar estas rutas
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado — solo admin' });
  }
  next();
}

// ----------------------------------------------------------------
// GET /api/admin/overview
// Todo lo que necesita el panel de admin en una sola llamada
// ----------------------------------------------------------------
router.get('/overview', authenticateToken, requireAdmin, async (req, res) => {
  const pool = getPool();
  try {
    // Todos los clientes
    const usersResult = await pool.query(
      `SELECT id, email, role, plan_type, credits_remaining, reseller_id, created_at
       FROM users
       WHERE role = 'customer'
       ORDER BY created_at DESC`
    );

    // Todos los resellers con conteo de sus clientes
    const resellersResult = await pool.query(
      `SELECT u.id, u.email, u.created_at,
              COUNT(c.id) as client_count
       FROM users u
       LEFT JOIN users c ON c.reseller_id = u.id AND c.role = 'customer'
       WHERE u.role = 'reseller'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );

    // Total campañas
    const campaignsResult = await pool.query(
      'SELECT COUNT(*) as total FROM campaigns'
    );

    return res.json({
      users:            usersResult.rows,
      resellers:        resellersResult.rows,
      total_clients:    usersResult.rows.length,
      total_resellers:  resellersResult.rows.length,
      total_campaigns:  parseInt(campaignsResult.rows[0].total)
    });

  } catch (err) {
    console.error('Admin overview error:', err);
    return res.status(500).json({ error: 'Error al cargar datos' });
  } finally {
    await pool.end();
  }
});

// ----------------------------------------------------------------
// POST /api/admin/users/create
// Admin crea cualquier tipo de usuario (customer o reseller)
// ----------------------------------------------------------------
router.post('/users/create', authenticateToken, requireAdmin, async (req, res) => {
  const { email, password, plan_type, role, reseller_id } = req.body;
  const pool = getPool();

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email y contraseña requeridos (mín. 8 caracteres)' });
  }

  const PLAN_CREDITS = { starter:10, pro:30, agency:100 };
  const credits = PLAN_CREDITS[plan_type] || 0;

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Este email ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (email, password_hash, role, plan_type, credits_remaining, reseller_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [email, hash, role || 'customer', plan_type || 'starter', credits, reseller_id || null]
    );

    return res.json({ success: true });

  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Error al crear usuario' });
  } finally {
    await pool.end();
  }
});

// ----------------------------------------------------------------
// POST /api/admin/credits/add
// Admin añade créditos a cualquier usuario
// ----------------------------------------------------------------
router.post('/credits/add', authenticateToken, async (req, res) => {
  // Permitido para admin Y reseller (reseller solo sus clientes — validado en reseller.js)
  if (req.user.role !== 'admin' && req.user.role !== 'reseller') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  const { user_id, credits } = req.body;
  const pool = getPool();

  if (!user_id || !credits || credits < 1) {
    return res.status(400).json({ error: 'Datos incorrectos' });
  }

  try {
    await pool.query(
      'UPDATE users SET credits_remaining = credits_remaining + $1 WHERE id = $2',
      [credits, user_id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Add credits error:', err);
    return res.status(500).json({ error: 'Error al añadir créditos' });
  } finally {
    await pool.end();
  }
});

// ----------------------------------------------------------------
// DELETE /api/admin/users/:id
// Admin elimina un usuario
// ----------------------------------------------------------------
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const pool = getPool();
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: 'Error al eliminar usuario' });
  } finally {
    await pool.end();
  }
});

module.exports = router;
