-- ============================================================
-- schema_FINAL.sql — Ads Engine Pro
-- Este archivo REEMPLAZA todos los schema anteriores
-- Ejecutar completo en Neon el día de producción
-- ============================================================

-- Tabla principal de usuarios (clientes, resellers, admin)
CREATE TABLE IF NOT EXISTS users (
  id                SERIAL PRIMARY KEY,
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  role              VARCHAR(20)  NOT NULL DEFAULT 'customer', -- customer | reseller | admin
  plan_type         VARCHAR(20)  NOT NULL DEFAULT 'starter',  -- starter | pro | agency
  credits_remaining INTEGER      NOT NULL DEFAULT 0,
  reseller_id       INTEGER      REFERENCES users(id),        -- qué reseller gestiona este cliente
  created_at        TIMESTAMP    DEFAULT NOW()
);

-- Tabla de campañas generadas
CREATE TABLE IF NOT EXISTS campaigns (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     VARCHAR(50) DEFAULT 'generated',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de pagos (registra cada compra en Lemon Squeezy)
CREATE TABLE IF NOT EXISTS payments (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) NOT NULL,
  plan           VARCHAR(50)  NOT NULL,
  credits        INTEGER      NOT NULL,
  amount         INTEGER      NOT NULL,
  lemon_order_id VARCHAR(100),
  created_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(lemon_order_id)
);

-- ============================================================
-- USUARIO ADMIN INICIAL — Francisco Blanco
-- IMPORTANTE: cambiar la contraseña después del primer login
-- La contraseña inicial es "password" — cámbiala inmediatamente en el primer login
-- ============================================================
INSERT INTO users (email, password_hash, role, plan_type, credits_remaining)
VALUES (
  'fblancomoreno@gmail.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
  'admin',
  'admin',
  999999
) ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- ÍNDICES para mejor rendimiento
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_reseller    ON users(reseller_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user    ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_email    ON payments(email);
