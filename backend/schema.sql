CREATE TABLE IF NOT EXISTS annual_limits (
  year INTEGER PRIMARY KEY,
  cap_cents BIGINT NOT NULL CHECK (cap_cents >= 0),
  reserved_cents BIGINT NOT NULL DEFAULT 0 CHECK (reserved_cents >= 0),
  captured_cents BIGINT NOT NULL DEFAULT 0 CHECK (captured_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  paypal_order_id TEXT UNIQUE,
  quantity_km2 INTEGER NOT NULL CHECK (quantity_km2 > 0),
  customer_email TEXT NOT NULL CHECK (length(customer_email) BETWEEN 3 AND 254),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency CHAR(3) NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  year INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','PAID','CANCELLED','DENIED','REFUNDED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migrazione per database già inizializzati prima dell’introduzione dell’email checkout.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
UPDATE orders SET customer_email = 'legacy@marte1km.invalid' WHERE customer_email IS NULL;
ALTER TABLE orders ALTER COLUMN customer_email SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_customer_email_length') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_customer_email_length CHECK (length(customer_email) BETWEEN 3 AND 254);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_paypal_order_id_idx ON orders (paypal_order_id);
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders (customer_email);
CREATE INDEX IF NOT EXISTS orders_year_status_idx ON orders (year, status);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
  nickname TEXT NOT NULL UNIQUE CHECK (length(nickname) BETWEEN 2 AND 32),
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_fkey') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS account_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL CHECK (token_type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_tokens_user_id_idx ON account_tokens (user_id);
CREATE INDEX IF NOT EXISTS account_tokens_expires_at_idx ON account_tokens (expires_at);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS annual_limits_touch_updated_at ON annual_limits;
CREATE TRIGGER annual_limits_touch_updated_at
BEFORE UPDATE ON annual_limits
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS orders_touch_updated_at ON orders;
CREATE TRIGGER orders_touch_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
