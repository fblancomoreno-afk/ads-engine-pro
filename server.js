// ============================================================
// ADS ENGINE PRO V8 - SERVIDOR PRINCIPAL
// Francisco Blanco | franciscoblanco.es
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// FIX: Trust proxy para Railway (evita ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
app.set('trust proxy', 1);

// ============================================================
// MIDDLEWARES GLOBALES
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting global - máximo 100 requests por 15 min por IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones. Espera 15 minutos.' }
});
app.use(globalLimiter);

// ============================================================
// ARCHIVOS ESTÁTICOS (HTML, CSS, JS del frontend)
// ============================================================
app.use(express.static(path.join(__dirname, 'frontend')));

// ============================================================
// RUTAS
// ============================================================
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/credits',   require('./routes/credits'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/reseller',  require('./routes/reseller'));
app.use('/api/webhooks',  require('./routes/webhooks'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: 'V8.3' });
});

// ============================================================
// ARRANQUE
// ============================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Ads Engine Pro V8 - Servidor en puerto ${PORT}`);
});

module.exports = app;
