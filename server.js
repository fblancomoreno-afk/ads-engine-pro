// ============================================================
// ADS ENGINE PRO V8 - SERVIDOR PRINCIPAL
// Francisco Blanco | franciscoblanco.es
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const app = express();

app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones. Espera 15 minutos.' },
});
app.use(globalLimiter);
app.use(cookieParser());

// ── Cookie-based route guard (does not touch API routes or authenticateToken) ──
function requireCookieAuth(req, res, next) {
  const token = req.cookies && req.cookies.ads_engine_token;
  if (!token) return res.redirect('/login');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.redirect('/login');
  }
}

app.get('/índice.html',    requireCookieAuth, (req, res) =>
  res.sendFile(path.join(__dirname, 'frontend', 'índice.html')));
app.get('/panel.html',     requireCookieAuth, (req, res) =>
  res.sendFile(path.join(__dirname, 'frontend', 'panel.html')));

app.use(express.static(path.join(__dirname, 'frontend')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/credits', require('./routes/credits'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reseller', require('./routes/reseller'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/campaigns', require('./routes/generate'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: 'V8.3' });
});

app.get('/', (req, res) => {
  res.redirect(301, '/login');
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Ads Engine Pro V8 - Servidor en puerto ${PORT}`);
});

module.exports = app;
