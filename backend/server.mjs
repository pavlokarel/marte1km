import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const app = express();
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined });
const port = Number(process.env.PORT || 8787);
const paypalBase = process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com';
const capCents = Number(process.env.ANNUAL_CAP_CENTS || 500000);
const pricePerKm2Cents = Number(process.env.PRICE_PER_KM2_CENTS || 100);
const reservationMinutes = Number(process.env.RESERVATION_MINUTES || 15);
const siteOrigin = process.env.SITE_ORIGIN || 'http://localhost:4173';

if (!process.env.DATABASE_URL || !process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET || !process.env.PAYPAL_WEBHOOK_ID) {
  console.warn('Missing DATABASE_URL or PayPal secrets: configure .env before starting Live.');
}

app.use(cors({ origin: siteOrigin, credentials: true }));
app.use(express.json({ limit: '256kb' }));
app.use(express.static(projectRoot, { index: 'index.html', extensions: ['html'] }));

function currentYearRome() {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date()));
}
function centsToAmount(cents) { return (cents / 100).toFixed(2); }
function makeId() { return crypto.randomUUID(); }
function paypalOrderIdFromEvent(event) {
  return event?.resource?.supplementary_data?.related_ids?.order_id || event?.resource?.id || null;
}
function jsonError(res, status, code, message) { return res.status(status).json({ error: code, message }); }
function normalizeEmail(value) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
function isValidEmail(value) { return value.length >= 3 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function normalizeNickname(value) { return typeof value === 'string' ? value.trim() : ''; }
function isValidNickname(value) { return /^[\p{L}\p{N}_.-]{2,32}$/u.test(value); }
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, derived) => error ? reject(error) : resolve(`scrypt:${salt}:${derived.toString('hex')}`))); }
async function verifyPassword(password, stored) { const [, salt, expectedHex] = String(stored).split(':'); if (!salt || !expectedHex) return false; const actual = await hashPassword(password, salt); const expected = Buffer.from(expectedHex, 'hex'); const received = Buffer.from(actual.split(':')[2], 'hex'); return expected.length === received.length && crypto.timingSafeEqual(expected, received); }
function parseCookies(request) { return Object.fromEntries((request.headers.cookie || '').split(';').map(item => item.trim().split('=').map(decodeURIComponent)).filter(pair => pair.length === 2)); }
function setSessionCookie(response, token) { response.setHeader('Set-Cookie', `marte_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${process.env.SITE_ORIGIN?.startsWith('https://') ? '; Secure' : ''}; Max-Age=2592000`); }
function clearSessionCookie(response) { response.setHeader('Set-Cookie', 'marte_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'); }
async function createSession(userId, response) { const token = crypto.randomBytes(32).toString('base64url'); await pool.query("INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')", [hashToken(token), userId]); setSessionCookie(response, token); }
async function currentUser(request) { const token = parseCookies(request).marte_session; if (!token) return null; const result = await pool.query('SELECT u.id, u.email, u.nickname FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()', [hashToken(token)]); return result.rows[0] || null; }
async function createAccountToken(userId, tokenType, ttlMinutes) {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  await pool.query('DELETE FROM account_tokens WHERE user_id = $1 AND token_type = $2 AND used_at IS NULL', [userId, tokenType]);
  await pool.query("INSERT INTO account_tokens (token_hash, user_id, token_type, expires_at) VALUES ($1, $2, $3, now() + ($4 * interval '1 minute'))", [hashToken(rawToken), userId, tokenType, ttlMinutes]);
  return rawToken;
}
async function sendTransactionalEmail({ to, subject, text, html }) {
  if (!process.env.RESEND_API_KEY) { console.warn(`Email provider not configured. To: ${to} Subject: ${subject}`); return false; }
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.MAIL_FROM || 'Marte1km <onboarding@resend.dev>', to: [to], subject, text, html }) });
  if (!response.ok) throw new Error(`Email provider failed: ${response.status}`);
  return true;
}
async function sendVerificationEmail(user, rawToken) {
  const link = `${siteOrigin}/verify-email.html?token=${encodeURIComponent(rawToken)}`;
  return sendTransactionalEmail({ to: user.email, subject: 'Verifica il tuo account Marte1km', text: `Ciao ${user.nickname}, verifica il tuo account aprendo questo link: ${link}. Il link scade tra 24 ore.`, html: `<p>Ciao ${user.nickname},</p><p>Verifica il tuo account Marte1km:</p><p><a href="${link}">Verifica email</a></p><p>Il link scade tra 24 ore.</p>` });
}
async function sendPasswordResetEmail(user, rawToken) {
  const link = `${siteOrigin}/reset-password.html?token=${encodeURIComponent(rawToken)}`;
  return sendTransactionalEmail({ to: user.email, subject: 'Reimposta la password Marte1km', text: `Reimposta la password aprendo questo link: ${link}. Il link scade tra 60 minuti.`, html: `<p>Puoi reimpostare la password di Marte1km:</p><p><a href="${link}">Reimposta password</a></p><p>Il link scade tra 60 minuti.</p>` });
}

app.post('/api/auth/register', async (req, res) => {
  const email = normalizeEmail(req.body?.email); const nickname = normalizeNickname(req.body?.nickname); const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!isValidEmail(email)) return jsonError(res, 400, 'invalid_email', 'Inserisci un indirizzo email valido');
  if (!isValidNickname(nickname)) return jsonError(res, 400, 'invalid_nickname', 'Il nickname deve avere 2–32 caratteri: lettere, numeri, punto, trattino o underscore');
  if (password.length < 8 || password.length > 128) return jsonError(res, 400, 'invalid_password', 'La password deve avere almeno 8 caratteri');
  try { const passwordHash = await hashPassword(password); const id = makeId(); const result = await pool.query('INSERT INTO users (id, email, nickname, password_hash, email_verified) VALUES ($1, $2, $3, $4, FALSE) RETURNING id, email, nickname, email_verified', [id, email, nickname, passwordHash]); const token = await createAccountToken(id, 'EMAIL_VERIFICATION', 1440); await sendVerificationEmail(result.rows[0], token); return res.status(201).json({ user: result.rows[0], verification_required: true, message: 'Controlla la tua email per attivare l’account.' }); }
  catch (error) { if (error.code === '23505') return jsonError(res, 409, 'account_exists', 'Email o nickname già utilizzati'); console.error(error); return jsonError(res, 500, 'registration_failed', 'Registrazione non disponibile'); }
});
app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email); const password = typeof req.body?.password === 'string' ? req.body.password : '';
  try { const result = await pool.query('SELECT id, email, nickname, password_hash, email_verified FROM users WHERE email = $1', [email]); const user = result.rows[0]; if (!user || !(await verifyPassword(password, user.password_hash))) return jsonError(res, 401, 'invalid_credentials', 'Email o password non corrette'); if (!user.email_verified) return jsonError(res, 403, 'email_not_verified', 'Verifica la tua email prima di accedere'); await createSession(user.id, res); return res.json({ user: { id: user.id, email: user.email, nickname: user.nickname, email_verified: true } }); }
  catch (error) { console.error(error); return jsonError(res, 500, 'login_failed', 'Accesso non disponibile'); }
});
app.post('/api/auth/verify-email', async (req, res) => { try { const token = typeof req.body?.token === 'string' ? req.body.token : ''; const result = await pool.query("UPDATE users SET email_verified = TRUE, updated_at = now() WHERE id = (SELECT user_id FROM account_tokens WHERE token_hash = $1 AND token_type = 'EMAIL_VERIFICATION' AND used_at IS NULL AND expires_at > now()) RETURNING id, email, nickname", [hashToken(token)]); if (!result.rows[0]) return jsonError(res, 400, 'invalid_verification_token', 'Il link non è valido o è scaduto'); await pool.query("UPDATE account_tokens SET used_at = now() WHERE token_hash = $1", [hashToken(token)]); return res.json({ user: result.rows[0], message: 'Email verificata. Ora puoi accedere.' }); } catch (error) { console.error(error); return jsonError(res, 500, 'verification_failed', 'Verifica non disponibile'); } });
app.post('/api/auth/resend-verification', async (req, res) => { try { const email = normalizeEmail(req.body?.email); const result = await pool.query('SELECT id, email, nickname, email_verified FROM users WHERE email = $1', [email]); if (result.rows[0] && !result.rows[0].email_verified) { const token = await createAccountToken(result.rows[0].id, 'EMAIL_VERIFICATION', 1440); await sendVerificationEmail(result.rows[0], token); } return res.json({ message: 'Se l’account esiste e non è verificato, riceverai una nuova email.' }); } catch (error) { console.error(error); return jsonError(res, 500, 'resend_failed', 'Impossibile reinviare la verifica'); } });
app.post('/api/auth/forgot-password', async (req, res) => { try { const email = normalizeEmail(req.body?.email); const result = await pool.query('SELECT id, email, nickname FROM users WHERE email = $1', [email]); if (result.rows[0]) { const token = await createAccountToken(result.rows[0].id, 'PASSWORD_RESET', 60); await sendPasswordResetEmail(result.rows[0], token); } return res.json({ message: 'Se l’email è associata a un account, riceverai un link per reimpostare la password.' }); } catch (error) { console.error(error); return jsonError(res, 500, 'reset_request_failed', 'Impossibile avviare il recupero password'); } });
app.post('/api/auth/reset-password', async (req, res) => { try { const token = typeof req.body?.token === 'string' ? req.body.token : ''; const password = typeof req.body?.password === 'string' ? req.body.password : ''; if (password.length < 8 || password.length > 128) return jsonError(res, 400, 'invalid_password', 'La password deve avere almeno 8 caratteri'); const user = await pool.query("SELECT user_id FROM account_tokens WHERE token_hash = $1 AND token_type = 'PASSWORD_RESET' AND used_at IS NULL AND expires_at > now()", [hashToken(token)]); if (!user.rows[0]) return jsonError(res, 400, 'invalid_reset_token', 'Il link non è valido o è scaduto'); await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [await hashPassword(password), user.rows[0].user_id]); await pool.query("UPDATE account_tokens SET used_at = now() WHERE token_hash = $1", [hashToken(token)]); await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [user.rows[0].user_id]); return res.json({ message: 'Password aggiornata. Ora puoi accedere.' }); } catch (error) { console.error(error); return jsonError(res, 500, 'reset_failed', 'Impossibile aggiornare la password'); } });
app.get('/api/auth/me', async (req, res) => { try { return res.json({ user: await currentUser(req) }); } catch (error) { console.error(error); return jsonError(res, 500, 'session_failed', 'Sessione non disponibile'); } });
app.post('/api/auth/logout', async (req, res) => { try { const token = parseCookies(req).marte_session; if (token) await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]); clearSessionCookie(res); return res.json({ ok: true }); } catch (error) { console.error(error); return jsonError(res, 500, 'logout_failed', 'Impossibile chiudere la sessione'); } });

async function paypalAccessToken() {
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${paypalBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if (!response.ok) throw new Error(`PayPal OAuth failed: ${response.status}`);
  return (await response.json()).access_token;
}
async function paypalRequest(path, { method = 'GET', body, idempotencyKey } = {}) {
  const token = await paypalAccessToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['PayPal-Request-Id'] = idempotencyKey;
  const response = await fetch(`${paypalBase}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let payload; try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  if (!response.ok) { const error = new Error(`PayPal API ${response.status}`); error.status = response.status; error.payload = payload; throw error; }
  return payload;
}

let cachedClientToken = null;
let cachedClientTokenExpiresAt = 0;
async function paypalClientToken() {
  if (cachedClientToken && Date.now() < cachedClientTokenExpiresAt) return cachedClientToken;
  const accessToken = await paypalAccessToken();
  const response = await fetch(`${paypalBase}/v1/identity/generate-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Accept-Language': 'en_US', 'Content-Type': 'application/json' }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.client_token) throw new Error(`PayPal client token failed: ${response.status}`);
  cachedClientToken = data.client_token;
  cachedClientTokenExpiresAt = Date.now() + 14 * 60_000;
  return cachedClientToken;
}

async function ensureYear(client, year) {
  await client.query(`INSERT INTO annual_limits (year, cap_cents) VALUES ($1, $2) ON CONFLICT (year) DO NOTHING`, [year, capCents]);
}
async function releaseExpiredReservations(client) {
  const expired = await client.query(`SELECT year, amount_cents FROM orders WHERE status = 'PENDING' AND expires_at < now() FOR UPDATE`);
  for (const row of expired.rows) {
    await client.query(`UPDATE annual_limits SET reserved_cents = GREATEST(0, reserved_cents - $1) WHERE year = $2`, [row.amount_cents, row.year]);
  }
  await client.query(`UPDATE orders SET status = 'CANCELLED' WHERE status = 'PENDING' AND expires_at < now()`, []);
}
async function capacity(client, year = currentYearRome()) {
  await ensureYear(client, year);
  const result = await client.query(`SELECT year, cap_cents, reserved_cents, captured_cents, GREATEST(0, cap_cents - reserved_cents - captured_cents) AS available_cents FROM annual_limits WHERE year = $1`, [year]);
  const row = result.rows[0];
  return { year: row.year, cap_eur: Number(row.cap_cents) / 100, reserved_eur: Number(row.reserved_cents) / 100, captured_eur: Number(row.captured_cents) / 100, remaining_eur: Number(row.available_cents) / 100 };
}

app.get('/api/paypal/client-token', async (_req, res) => {
  try { return res.json({ client_token: await paypalClientToken(), expires_in: 840 }); }
  catch (error) { console.error(error); return jsonError(res, 503, 'paypal_client_token_unavailable', 'Card Fields PayPal non disponibili'); }
});

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); return res.json({ ok: true, environment: process.env.PAYPAL_ENV || 'live' }); }
  catch { return jsonError(res, 503, 'database_unavailable', 'Database non disponibile'); }
});

app.get('/api/capacity', async (_req, res) => {
  const client = await pool.connect();
  try { await releaseExpiredReservations(client); return res.json(await capacity(client)); }
  catch (error) { console.error(error); return jsonError(res, 500, 'capacity_failed', 'Impossibile leggere la disponibilità'); }
  finally { client.release(); }
});

app.post('/api/orders', async (req, res) => {
  const quantity = Number(req.body?.quantity_km2);
  const customerEmail = normalizeEmail(req.body?.customer_email);
  const user = await currentUser(req).catch(() => null);
  if (!isValidEmail(customerEmail)) return jsonError(res, 400, 'invalid_email', 'Inserisci un indirizzo email valido per ricevere il certificato');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return jsonError(res, 400, 'invalid_quantity', 'La quantità deve essere un intero tra 1 e 99 km²');
  const amountCents = quantity * pricePerKm2Cents;
  const year = currentYearRome();
  const orderId = makeId();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureYear(client, year);
    await releaseExpiredReservations(client);
    const limit = await client.query(`SELECT * FROM annual_limits WHERE year = $1 FOR UPDATE`, [year]);
    const row = limit.rows[0];
    const available = Number(row.cap_cents) - Number(row.reserved_cents) - Number(row.captured_cents);
    if (amountCents > available) { await client.query('ROLLBACK'); return jsonError(res, 409, 'annual_cap_reached', 'La soglia annuale disponibile non consente questo ordine'); }
    const expiresAt = new Date(Date.now() + reservationMinutes * 60_000);
    await client.query(`INSERT INTO orders (id, quantity_km2, customer_email, user_id, amount_cents, year, status, expires_at) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)`, [orderId, quantity, customerEmail, user?.id || null, amountCents, year, expiresAt]);
    await client.query(`UPDATE annual_limits SET reserved_cents = reserved_cents + $1 WHERE year = $2`, [amountCents, year]);
    await client.query('COMMIT');

    let paypalOrder;
    try {
      paypalOrder = await paypalRequest('/v2/checkout/orders', {
        method: 'POST', idempotencyKey: orderId,
        body: { intent: 'CAPTURE', purchase_units: [{ reference_id: orderId, custom_id: orderId, description: 'Marte1km — souvenir simbolico, non proprietà reale', amount: { currency_code: 'EUR', value: centsToAmount(amountCents) } }], application_context: { brand_name: 'Marte1km', user_action: 'PAY_NOW', return_url: `${siteOrigin}/payment-return.html?order_id=${orderId}`, cancel_url: `${siteOrigin}/index.html?payment=cancelled` } }
      });
    } catch (error) {
      const rollbackClient = await pool.connect();
      try { await rollbackClient.query('BEGIN'); await rollbackClient.query(`UPDATE annual_limits SET reserved_cents = GREATEST(0, reserved_cents - $1) WHERE year = $2`, [amountCents, year]); await rollbackClient.query(`UPDATE orders SET status = 'CANCELLED' WHERE id = $1 AND status = 'PENDING'`, [orderId]); await rollbackClient.query('COMMIT'); } finally { rollbackClient.release(); }
      throw error;
    }
    const approval = paypalOrder.links?.find(link => link.rel === 'approve')?.href;
    const saved = await pool.query(`UPDATE orders SET paypal_order_id = $1 WHERE id = $2 RETURNING id, paypal_order_id, quantity_km2, amount_cents, status, expires_at`, [paypalOrder.id, orderId]);
    return res.status(201).json({ order: { ...saved.rows[0], amount_eur: Number(saved.rows[0].amount_cents) / 100 }, approval_url: approval });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error(error); return jsonError(res, error.status === 422 ? 422 : 502, 'paypal_order_failed', 'Impossibile creare l’ordine PayPal');
  } finally { client.release(); }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, paypal_order_id, quantity_km2, amount_cents, currency, status, expires_at, created_at, captured_at FROM orders WHERE id = $1`, [req.params.id]);
    const order = result.rows[0];
    if (!order) return jsonError(res, 404, 'order_not_found', 'Ordine non trovato');
    return res.json({ order: { ...order, amount_eur: Number(order.amount_cents) / 100 } });
  } catch (error) { console.error(error); return jsonError(res, 500, 'order_status_failed', 'Impossibile leggere lo stato dell’ordine'); }
});

app.post('/api/orders/:id/capture', async (req, res) => {
  const client = await pool.connect();
  try {
    const found = await client.query(`SELECT * FROM orders WHERE id = $1`, [req.params.id]);
    const order = found.rows[0];
    if (!order?.paypal_order_id) return jsonError(res, 404, 'order_not_found', 'Ordine non trovato');
    if (order.status === 'PAID') return res.json({ paid: true, order_id: order.id });
    if (new Date(order.expires_at) < new Date()) return jsonError(res, 409, 'reservation_expired', 'La prenotazione è scaduta');
    const captured = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(order.paypal_order_id)}/capture`, { method: 'POST', idempotencyKey: `${order.id}-capture`, body: {} });
    return res.json({ paid: captured.status === 'COMPLETED', paypal_status: captured.status, paypal_order_id: order.paypal_order_id });
  } catch (error) { console.error(error); return jsonError(res, 502, 'capture_failed', 'Impossibile catturare il pagamento'); }
  finally { client.release(); }
});

async function verifyWebhook(headers, event) {
  const token = await paypalAccessToken();
  const response = await fetch(`${paypalBase}/v1/notifications/verify-webhook-signature`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_algo: headers['paypal-auth-algo'], cert_url: headers['paypal-cert-url'], transmission_id: headers['paypal-transmission-id'], transmission_sig: headers['paypal-transmission-sig'], transmission_time: headers['paypal-transmission-time'], webhook_id: process.env.PAYPAL_WEBHOOK_ID, webhook_event: event }) });
  if (!response.ok) return false;
  return (await response.json()).verification_status === 'SUCCESS';
}

app.post('/api/paypal/webhook', async (req, res) => {
  const headers = req.headers;
  try {
    if (!(await verifyWebhook(headers, req.body))) return jsonError(res, 400, 'invalid_signature', 'Firma webhook non valida');
    const event = req.body; const eventId = event.id; const eventType = event.event_type; const paypalOrderId = paypalOrderIdFromEvent(event);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(`INSERT INTO webhook_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`, [eventId, eventType]);
      if (!inserted.rowCount) { await client.query('COMMIT'); return res.json({ received: true, duplicate: true }); }
      const orderResult = await client.query(`SELECT * FROM orders WHERE paypal_order_id = $1 FOR UPDATE`, [paypalOrderId]);
      const order = orderResult.rows[0];
      if (!order) { await client.query('COMMIT'); return res.json({ received: true, matched: false }); }
      if (eventType === 'CHECKOUT.ORDER.APPROVED') await client.query(`UPDATE orders SET status = 'APPROVED' WHERE id = $1 AND status = 'PENDING'`, [order.id]);
      if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        const resource = event.resource || {}; const amountCents = Math.round(Number(resource.amount?.value || 0) * 100); const currency = resource.amount?.currency_code;
        if (currency !== order.currency || amountCents !== Number(order.amount_cents)) throw new Error('Webhook amount/currency mismatch');
        if (order.status !== 'PAID') {
          await client.query(`UPDATE orders SET status = 'PAID', captured_at = now() WHERE id = $1`, [order.id]);
          await client.query(`UPDATE annual_limits SET reserved_cents = GREATEST(0, reserved_cents - $1), captured_cents = captured_cents + $1 WHERE year = $2`, [order.amount_cents, order.year]);
        }
      }
      if (['PAYMENT.CAPTURE.DENIED', 'CHECKOUT.ORDER.VOIDED'].includes(eventType) && ['PENDING','APPROVED'].includes(order.status)) {
        await client.query(`UPDATE orders SET status = 'DENIED', updated_at = now() WHERE id = $1`, [order.id]);
        await client.query(`UPDATE annual_limits SET reserved_cents = GREATEST(0, reserved_cents - $1) WHERE year = $2`, [order.amount_cents, order.year]);
      }
      if (eventType === 'PAYMENT.CAPTURE.REFUNDED') await client.query(`UPDATE orders SET status = 'REFUNDED' WHERE id = $1 AND status = 'PAID'`, [order.id]);
      await client.query('COMMIT'); return res.json({ received: true, matched: true });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  } catch (error) { console.error(error); return jsonError(res, 500, 'webhook_processing_failed', 'Errore nella gestione del webhook'); }
});

app.get('/api/account/summary', async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return jsonError(res, 401, 'not_authenticated', 'Accedi per vedere i tuoi acquisti');
    const result = await pool.query(`SELECT id, quantity_km2, amount_cents, status, created_at FROM orders WHERE user_id = $1 AND status IN ('PAID','APPROVED','PENDING') ORDER BY created_at DESC`, [user.id]);
    const purchases = result.rows.map(order => ({ id: order.id, km: order.quantity_km2, total: Number(order.amount_cents) / 100, status: order.status, date: new Date(order.created_at).toLocaleDateString('it-IT') }));
    return res.json({ user, purchases, totals: { km: purchases.reduce((sum, item) => sum + item.km, 0), orders: purchases.length, amount: purchases.reduce((sum, item) => sum + item.total, 0) } });
  } catch (error) { console.error(error); return jsonError(res, 500, 'summary_failed', 'Impossibile leggere il riepilogo account'); }
});

setInterval(async () => { const client = await pool.connect(); try { await client.query('BEGIN'); await releaseExpiredReservations(client); await client.query('COMMIT'); } catch { try { await client.query('ROLLBACK'); } catch {} } finally { client.release(); } }, 60_000).unref();

app.listen(port, () => console.log(`Marte1km backend listening on :${port}`));
