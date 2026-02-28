// routes/webhooks.js — ACTUALIZADO Día 6
// Este archivo REEMPLAZA al webhooks.js del Día 1
//
// Qué hace:
// Lemon Squeezy llama a esta URL cuando alguien paga.
// El servidor activa la cuenta del cliente automáticamente.
//
// En Lemon Squeezy configurar:
//   Webhook URL: https://tu-servidor.vercel.app/api/webhooks/lemon
//   Eventos: order_created, subscription_created

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const { Pool } = require('pg');

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

// Planes: relaciona el ID del producto en Lemon Squeezy con créditos y plan
// Día 7: sustituir estos IDs por los reales de tu cuenta Lemon Squeezy
const LEMON_PLANS = {
  [process.env.LEMON_PRODUCT_STARTER]: { plan: 'starter', credits: 10,  price: 249 },
  [process.env.LEMON_PRODUCT_PRO]:     { plan: 'pro',     credits: 30,  price: 590 },
  [process.env.LEMON_PRODUCT_AGENCY]:  { plan: 'agency',  credits: 100, price: 1490 },
};

// ----------------------------------------------------------------
// Verificar firma de Lemon Squeezy (seguridad)
// Evita que alguien llame al webhook sin ser Lemon Squeezy
// ----------------------------------------------------------------
function verifySignature(rawBody, signature) {
  const secret = process.env.LEMON_WEBHOOK_SECRET;
  if (!secret) return true; // En desarrollo sin secret, pasar
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

// ----------------------------------------------------------------
// POST /api/webhooks/lemon
// Lemon Squeezy llama aquí cuando se produce un pago
// ----------------------------------------------------------------
router.post('/lemon', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-signature'];
  const rawBody   = req.body;

  // Verificar que viene de Lemon Squeezy
  if (signature && !verifySignature(rawBody, signature)) {
    console.error('Webhook: firma inválida');
    return res.status(401).json({ error: 'Firma inválida' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch(e) {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  const eventName = event.meta?.event_name;
  const data      = event.data?.attributes;

  console.log(`Webhook recibido: ${eventName}`);

  // Solo procesamos pagos completados
  if (eventName !== 'order_created') {
    return res.status(200).json({ received: true });
  }

  // Datos del comprador
  const customerEmail = data?.user_email;
  const productId     = String(data?.first_order_item?.product_id || '');
  const planConfig    = LEMON_PLANS[productId];

  if (!customerEmail) {
    console.error('Webhook: sin email de cliente');
    return res.status(400).json({ error: 'Sin email' });
  }

  if (!planConfig) {
    console.error(`Webhook: producto desconocido ${productId}`);
    return res.status(200).json({ received: true }); // No es error, puede ser otro producto
  }

  const pool = getPool();
  try {
    // ¿El usuario ya existe?
    const existing = await pool.query(
      'SELECT id, credits_remaining FROM users WHERE email = $1',
      [customerEmail]
    );

    if (existing.rows.length > 0) {
      // Usuario existente — añadir créditos (recarga)
      await pool.query(
        `UPDATE users
         SET credits_remaining = credits_remaining + $1,
             plan_type = $2
         WHERE email = $3`,
        [planConfig.credits, planConfig.plan, customerEmail]
      );
      console.log(`Créditos añadidos a ${customerEmail}: +${planConfig.credits}`);

    } else {
      // Usuario nuevo — crear cuenta con contraseña temporal
      const tempPassword = Math.random().toString(36).slice(-8); // 8 caracteres aleatorios
      const hash = await bcrypt.hash(tempPassword, 10);

      await pool.query(
        `INSERT INTO users (email, password_hash, role, plan_type, credits_remaining, created_at)
         VALUES ($1, $2, 'customer', $3, $4, NOW())`,
        [customerEmail, hash, planConfig.plan, planConfig.credits]
      );

      console.log(`Usuario creado: ${customerEmail} — Plan: ${planConfig.plan} — Contraseña temporal: ${tempPassword}`);

      // TODO Día 7: enviar email al cliente con su contraseña temporal
      // sendWelcomeEmail(customerEmail, tempPassword);
    }

    // Registrar el pago
    await pool.query(
      `INSERT INTO payments (email, plan, credits, amount, lemon_order_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [customerEmail, planConfig.plan, planConfig.credits, planConfig.price, data?.order_number || null]
    );

    return res.status(200).json({ success: true });

  } catch(err) {
    console.error('Webhook DB error:', err);
    return res.status(500).json({ error: 'Error interno' });
  } finally {
    await pool.end();
  }
});

module.exports = router;
