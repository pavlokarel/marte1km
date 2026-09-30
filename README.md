# Marte1km

Prototype web app for symbolic Mars souvenir plots. It serves the Italian frontend and the Express API from the same Node service.

## Local start

```bash
npm install
cp .env.example .env
npm start
```

The database must be initialized with `backend/schema.sql` before using accounts or checkout.

## Render deployment

- Runtime: Node
- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/health`
- Region: Frankfurt (recommended for Italy)

Required production secrets are documented in `.env.example`. Never commit real PayPal, database, or email credentials.
