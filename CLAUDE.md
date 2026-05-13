# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — run the server (`node server/index.js`)
- `npm run dev` — run with nodemon for auto-reload
- `npm run build` / `./build.sh` — compile JSX from `public/js/` to `public/dist/js/` via Babel
- `./watch.sh` — watch and rebuild JSX on change during frontend development

There are no tests, linter, or typechecker configured. After editing any file under `public/js/`, you must run `./build.sh` (or have `watch.sh` running) before changes are visible — the browser loads only the compiled `public/dist/js/` output.

The server listens on HTTP `8081` and, if `ssl/key.pem` + `ssl/cert.pem` exist, HTTPS `8443`.

Required env vars (loaded from `.env` at repo root by `server/index.js`): `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (`sandbox`/`live`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.

MySQL connection is **hardcoded** in `server/database.js` (host `127.0.0.1`, user `poke4trade`, db `poke4trade`) — not from env.

## Architecture

This is a Pokémon TCG trading/marketplace app. Three deliberately unusual choices to know up front:

### Frontend: no bundler, no SPA router, React via CDN

`public/index.html` loads React 18 UMD from a CDN, then `<script>`-includes every compiled file under `public/dist/js/` in dependency order. Each source file (`public/js/components/*.js`, `public/js/pages/*.js`, etc.) defines a top-level component and attaches it to `window` so later scripts can reference it. There is no module system — `import`/`export` will not work.

JSX is the only thing Babel handles (`babel.config.json` is just `@babel/preset-react`). `build.sh` runs Babel folder-by-folder from `public/js/` into `public/dist/js/`. Editing a file under `public/dist/js/` directly is wrong; edit `public/js/` and rebuild.

"Routing" is a `switch(currentPage)` in `public/js/App.js` over string page names (`'home'`, `'shop'`, `'my-trades'`, …). Navigation = calling `setCurrentPage(name, optionalData)`. There is no URL routing — pages don't have addressable URLs and refresh always lands on home.

State that crosses pages lives in three React contexts: `AuthContext` (user, persisted to `localStorage` as `poke4trade_user`), `CartContext`, `ToastContext`. When adding cross-page state, extend an existing context rather than introducing a new one.

### Backend: one giant Express file

**`server/index.js` is ~4,300 lines and contains every API route inline.** A `server/routes/` directory exists with files like `auth.js`, `trading.js`, etc., but `index.js` does not `require()` them — they appear to be an abandoned extraction. **When changing API behavior, edit `server/index.js`, not the files in `server/routes/`.** When adding routes, add them to `index.js` next to related endpoints (the file is divided by `// ====` banner comments by feature area: AUTH, PROFILE, LISTINGS, MARKETPLACE, TRADING, SHOP, CART, PAYMENTS, ORDERS, ADMIN, etc.).

Routes fall into two API surfaces:
- `/api/*` — application endpoints (auth, profile, listings, trading, shop, cart, orders, payments, admin)
- `/pokemon-api/*` — a shim that mimics the public `api.pokemontcg.io` response shape but reads from the local cached MySQL tables (`sets`, `cards`). Frontend uses this exclusively via `window.PokemonAPI` in `public/js/utils/api.js`.

Auth model: passwords are SHA-256 hashed (`hashPassword` in `index.js`). **No JWT, no sessions.** After login, the frontend keeps the user object in `localStorage` and the server identifies users by request body / URL params. Admin-only endpoints use the `requireAdmin` middleware (line ~3743), which reads the user id from the `x-user-id` request header and checks `users.is_admin`. So an admin call from the frontend must set `x-user-id` explicitly.

DB schema is created/migrated lazily at startup: `database.initDatabase()` creates the core `sets`/`cards`/`sync_log` tables; `initAdminTables()` (in `index.js` line ~2237) runs idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for newer columns on `users`, `trades`, `trade_ratings`, `trade_messages`, plus `site_settings`. There is no migration framework — to add a column, append another `ALTER TABLE` in `initAdminTables()`.

Use `database.query(sql, params)` (added at the bottom of `server/database.js`) for ad-hoc SQL. The exported pool-wrapping helpers (`getSets`, `getCardsForSet`, `searchCards`, `getStats`) are only used for the `/pokemon-api/*` shim.

### Pokémon TCG data sync

The `sets` and `cards` tables are populated from `api.pokemontcg.io`. Two paths:
- `database.syncSets()` / `syncCardsForSet()` / `syncAllCards()` in `server/database.js` — invoked manually; uses `curl` via `execSync` rather than `fetch`/`axios`.
- `sync-verify.js` at repo root — a separate long-running script (originally for a Raspberry Pi deployment; its `require()` paths are absolute, pointing at `/home/pi/poke4trade/`, so it does not run from this dev checkout). Runs in four phases: (1) initial sync, (2) retry pass for failed sets, (3) **TCGCSV price supplement** — when a set's cards are missing TCGPlayer prices, it looks up the matching TCGPlayer group on `tcgcsv.com/tcgplayer/3/...` and merges `groups`/`products`/`prices` into the card JSON, (4) summary. A Telegram bot (token + chat id hardcoded at the top of the file) posts start/finish/fatal notifications. State is tracked in `server/sync-state.json`.

`scripts/update_tax_rates.js` is a standalone cron job (TaxCloud V1 API → MySQL `tax_rates`), invoked by the host's system cron with an absolute `/home/pi/poke4trade/...` path baked into its header comment. It is the data source for the static-rate fallback in `/api/tax/calculate`.

## Conventions that aren't obvious from the code

- **Card prices** are extracted from the cached TCG JSON blob (`cards.data`) — see `extractTcgPrice` in `index.js` (~line 61) and `getCardMarketPrice` (~line 865). Preference order: `holofoil` → `reverseHolofoil` → `normal` → `1stEditionHolofoil` → `1stEditionNormal` → first available `.market`. Reuse these helpers rather than re-parsing prices inline.
- **Uploads**: profile pictures go to `uploads/profiles/user_<id>.<ext>` (served at `/uploads/...`); product images go to `public/uploads/products/` with random filenames. Multer is configured inline in `index.js`.
- **Email**: `sendTradeEmail` and `sendOrderEmail` (`index.js` ~lines 1285 / 1309) use nodemailer with SMTP creds from env. `ORDER_ADMIN_EMAIL = 'admin@poke4trade.com'` is hardcoded (`index.js:1307`) and receives a `[Admin] ...` copy of every order-lifecycle email — keep that constant in mind if you change the email pipeline. Email templates link to `https://poke4trade.com/...` (also hardcoded), so the production hostname is baked into the codebase, not env-driven.
- **No payment webhooks**: there are no Stripe or PayPal webhook handlers. Order state changes — including refunds — are driven by inline calls in `/api/payments/*`, `/api/orders/:orderId/cancel` (Stripe `refunds.create` ~line 3345, PayPal `/v2/payments/captures/:id/refund` ~line 3365), and `/api/orders/:orderId/status`. If the client never calls capture/cancel, the server never learns about the payment outcome — don't assume webhook reconciliation exists.
- **No rate limiting, CSRF protection, or session middleware** is installed. Auth endpoints, admin endpoints, and password-reset-style flows are all unthrottled.
- **TaxCloud** credentials are stored in the `site_settings` table (keys `taxcloud_api_id`, `taxcloud_api_key`), **not** in env. `/api/tax/calculate` calls TaxCloud V1 (`api.taxcloud.com/1.0/TaxCloud/Lookup` — note: the code comment says "v2" but the URL is v1) and falls back to the static `tax_rates` table populated by `scripts/update_tax_rates.js` whenever creds are missing or the API errors. `tax_enabled` (another `site_settings` row) is the master switch.
- The hardcoded DB password and the Pokémon TCG API key in `server/database.js` and `sync-verify.js`, plus the Telegram bot token in `sync-verify.js` (~line 7), are checked into the repo. Treat this as a known intentional state — don't "fix" by adding env-var indirection unless asked.
- **Vestigial deps**: `better-sqlite3` and `node-fetch` are in `package.json` but never `require()`d by any project file. Don't read them as a signal that an alternate DB or HTTP client is in use — the real DB is MySQL via `mysql2/promise`, and HTTP is `axios` (sync-verify), `fetch` (server PayPal calls), or `curl` via `execSync` (`database.js` TCG sync).

## Deployment / production notes

The repo does not contain any deployment manifests — no Dockerfile, no `docker-compose`, no PM2 ecosystem file, no systemd unit, no `.github/` workflows, no `.nvmrc`. What can be inferred:

- The production host is a Raspberry Pi: both `sync-verify.js` (line 1) and `scripts/update_tax_rates.js` (header comment) hardcode `/home/pi/poke4trade/` as the project root. Editing those paths is necessary if the host ever moves.
- The production domain is `poke4trade.com` (hardcoded in email-template CTAs throughout `server/index.js`).
- HTTPS uses a self-managed cert in `ssl/cert.pem` + `ssl/key.pem` on port 8443; if those are absent the HTTPS listener is silently skipped. The Pi presumably also fronts this with something external (likely a Cloudflare tunnel given the domain pattern), but no tunnel config is in this repo.
- TODO(verify): how the Node process is supervised on the Pi (PM2? systemd? screen?), and whether the SMTP host in production is Zoho via `admin@poke4trade.com`. Neither is determinable from the code alone — `SMTP_HOST` env var defaults to `smtp.gmail.com` in `index.js:1275` if unset.
