// routes/auth.js
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

// Rate limit login — máximo 5 intentos por 15 min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de login. Espera 15 minutos.' },
  skipSuccessfulRequests: true
});

// ----------------------------------------------------------------
// POST /api/auth/login
// ----------------------------------------------------------------
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const pool = getPool();
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, password_hash, is_active FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (!result.rows.length) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

    const user = result.rows[0];
    if (user.is_active === false) return res.status(401).json({ error: 'Cuenta inactiva. Contacta con soporte.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

    const token = jwt.sign(
      { userId: user.id, id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    let credits = null;
    if (user.role === 'customer') {
      const cr = await pool.query(
        'SELECT credits_remaining FROM users WHERE id = $1', [user.id]
      );
      credits = { credits_remaining: cr.rows[0]?.credits_remaining || 0 };
    }

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, credits } });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    await pool.end();
  }
});

// ----------------------------------------------------------------
// POST /api/auth/register — solo admin y reseller
// ----------------------------------------------------------------
router.post('/register', authenticateToken, async (req, res) => {
  if (!['admin', 'reseller'].includes(req.user.role)) {
    return res.status(403).json({ error: 'No tienes permisos para crear usuarios' });
  }

  const { email, password, name, role = 'customer' } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Email, contraseña y nombre requeridos' });
  if (req.user.role === 'reseller' && role !== 'customer') return res.status(403).json({ error: 'Solo puedes crear clientes' });

  const pool = getPool();
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Este email ya está registrado' });

    const password_hash = await bcrypt.hash(password, 12);
    const newUser = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, reseller_id, credits_remaining)
       VALUES ($1, $2, $3, $4, $5, 0) RETURNING id, email, name, role`,
      [email.toLowerCase().trim(), password_hash, name, role,
       req.user.role === 'reseller' ? req.user.id : null]
    );

    res.status(201).json({ message: 'Usuario creado correctamente', user: newUser.rows[0] });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    await pool.end();
  }
});

// ----------------------------------------------------------------
// GET /api/auth/me
// ----------------------------------------------------------------
router.get('/me', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, credits_remaining FROM users WHERE id = $1', [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    await pool.end();
  }
});

module.exports = router;
