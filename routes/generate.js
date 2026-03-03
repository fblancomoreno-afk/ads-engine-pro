// routes/generate.js
// Ruta principal que llama a la API de Anthropic para generar campañas
const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const authenticateToken = require('../middleware/auth');
const { Pool } = require('pg');

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

// Rate limiting simple: 1 campaña cada 60 segundos por usuario
const lastGenerationTime = new Map();

// POST /api/campaigns/generate
router.post('/generate', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  // Rate limit: 1 campaña por minuto
  const now = Date.now();
  const last = lastGenerationTime.get(userId) || 0;
  if (now - last < 60000) {
    const waitSeconds = Math.ceil((60000 - (now - last)) / 1000);
    return res.status(429).json({
      error: `Espera ${waitSeconds} segundos antes de generar otra campaña.`
    });
  }
  lastGenerationTime.set(userId, now);

  const { prompt, formData } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Falta el prompt para generar la campaña.' });
  }

  // Usamos un único pool para todo el flujo (descontar -> IA -> guardar)
  const pool = getPool();
  let discountApplied = false;

  try {
    // ------------------------------------------------------------
    // 1) BLOQUEO + DESCUENTO ATÓMICO (1 campaña = 1 crédito)
    // ------------------------------------------------------------
    const dec = await pool.query(
      `UPDATE users
       SET credits_remaining = credits_remaining - 1
       WHERE id = $1 AND credits_remaining > 0
       RETURNING credits_remaining`,
      [userId]
    );

    if (dec.rowCount === 0) {
      return res.status(402).json({
        error: 'No tienes campañas disponibles. Compra un paquete para seguir.'
      });
    }

    discountApplied = true;

    // ------------------------------------------------------------
    // 2) Llamada a la API de Anthropic (solo si hay campañas)
    // ------------------------------------------------------------
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const campaignText = message.content?.[0]?.text || '';

    // ------------------------------------------------------------
    // 3) Guardar en base de datos (no crítico)
    // ------------------------------------------------------------
    try {
      await pool.query(
        `INSERT INTO campaigns (user_id, status, campaign_data, created_at)
         VALUES ($1, 'completed', $2, NOW())`,
        [userId, JSON.stringify({ prompt: formData, result: campaignText })]
      );
    } catch (dbErr) {
      console.error('Error guardando campaña en DB (no crítico):', dbErr.message);
    }

    return res.json({ campaignText });

  } catch (err) {
    console.error('Error en generación (Anthropic o sistema):', err);

    // Si falló Anthropic (o algo) y ya descontamos, devolvemos la campaña
    if (discountApplied) {
      try {
        await pool.query(
          `UPDATE users
           SET credits_remaining = credits_remaining + 1
           WHERE id = $1`,
          [userId]
        );
      } catch (e) {
        console.error('No se pudo revertir el crédito:', e.message);
      }
    }

    return res.status(500).json({
      error: 'Error al generar la campaña con IA. Inténtalo de nuevo.'
    });
  } finally {
    await pool.end();
  }
});

module.exports = router;
