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

  try {
    // Llamada a la API de Anthropic
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

    const campaignText = message.content[0].text;

    // Guardar en base de datos
    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO campaigns (user_id, status, campaign_data, created_at)
         VALUES ($1, 'completed', $2, NOW())`,
        [userId, JSON.stringify({ prompt: formData, result: campaignText })]
      );
    } catch (dbErr) {
      console.error('Error guardando campaña en DB (no crítico):', dbErr.message);
    } finally {
      await pool.end();
    }

    return res.json({ campaignText });

  } catch (err) {
    console.error('Error llamando a Anthropic:', err);
    return res.status(500).json({
      error: 'Error al generar la campaña con IA. Inténtalo de nuevo.'
    });
  }
});

module.exports = router;
