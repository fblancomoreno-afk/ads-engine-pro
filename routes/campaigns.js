// routes/campaigns.js  (ACTUALIZADO Día 3 — añadir ruta GET /my)
// Este archivo reemplaza al campaigns.js del Día 1
// Añade el endpoint que el dashboard necesita para mostrar el historial

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { Pool } = require('pg');

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

// ----------------------------------------------------------------
// GET /api/campaigns/my
// Devuelve el historial de campañas del usuario autenticado
// El dashboard lo usa para mostrar la lista
// ----------------------------------------------------------------
router.get('/my', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, created_at, status
       FROM campaigns
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    return res.json(result.rows);

  } catch (err) {
    console.error('Error fetching campaigns:', err);
    return res.status(500).json({ error: 'Error al obtener historial' });
  } finally {
    await pool.end();
  }
});

// ----------------------------------------------------------------
// GET /api/campaigns/count
// Devuelve solo el número total de campañas del usuario
// ----------------------------------------------------------------
router.get('/count', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as total FROM campaigns WHERE user_id = $1',
      [req.user.id]
    );

    return res.json({ total: parseInt(result.rows[0].total) });

  } catch (err) {
    console.error('Error counting campaigns:', err);
    return res.status(500).json({ error: 'Error al contar campañas' });
  } finally {
    await pool.end();
  }
});

module.exports = router;
