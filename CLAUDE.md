# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch policy

- **`staging` is the default working branch.** All feature work, fixes, and ad-hoc commits land here first.
- **`main` only advances via `scripts/promote-to-prod.sh`**, which fast-forwards `main` to `origin/staging` and pushes — refusing any non-fast-forward (operator must reconcile manually).
- **Release tags on `main`: `prod-YYYYMMDD-HHMM`**, created and pushed by the promote script.
- Commits with `MIGRATION:` in the subject force a manual `migrations applied` confirmation at promote time. Use that prefix whenever a commit requires a manual DB step before deploy.

## Commands

- `npm start` — run the server (`node server/index.js`)
- `npm run dev` — run with nodemon for auto-reload
- `npm run build` / `./build.sh` — compile JSX from `public/js/` to `public/dist/js/` via Babel
- `./watch.sh` — watch and rebuild JSX on change during frontend development

There are no tests, linter, or typechecker configured. After editing any file under `public/js/`, you must run `./build.sh` (or have `watch.sh` running) before changes are visible — the browser loads only the compiled `public/dist/js/` output.

The server listens on HTTP `8081` and, if `ssl/key.pem` + `ssl/cert.pem` exist, HTTPS `8443`.

Required env vars (loaded from `.env` at repo root by `server/index.js`): `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (`sandbox`/`live`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.

MySQL connection in `server/database.js` reads `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` from env, **with the prod values as defaults**. So prod with no env set behaves exactly as before; staging overrides `DB_NAME=poke4trade_staging` via its systemd unit.

HTTP/HTTPS ports in `server/index.js` similarly read `PORT` / `HTTPS_PORT` from env, defaulting to 8081 / 8443. The HTTPS listener still only starts if `ssl/key.pem` + `ssl/cert.pem` exist.

`GET /health` returns `200` with `{ status, env, commit, time }` and is **unauthenticated** — used by deploy/rollback scripts and any external uptime check. `commit` reflects `process.env.COMMIT_SHA`, written by the deploy scripts into `<repo>/.env.runtime` and surfaced via the systemd unit's `EnvironmentFile=` directive.

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
- DB credentials in `server/database.js` are now env-overridable (`DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`) with the original hardcoded values as defaults — used by the staging deploy. The Pokémon TCG API key in `server/database.js` and the Telegram bot token + TCG API key in `sync-verify.js` (~line 7) are **still hardcoded**. Don't "fix" those by adding env-var indirection unless asked.
- **Vestigial deps**: `better-sqlite3` and `node-fetch` are in `package.json` but never `require()`d by any project file. Don't read them as a signal that an alternate DB or HTTP client is in use — the real DB is MySQL via `mysql2/promise`, and HTTP is `axios` (sync-verify), `fetch` (server PayPal calls), or `curl` via `execSync` (`database.js` TCG sync).

## Deployment

The Pi (`pinas`, `pi@10.0.0.208` on LAN) hosts both prod and staging side-by-side. Prod is at `/home/pi/poke4trade` on port 8081 (Cloudflare tunnel routes `poke4trade.com` + `www.poke4trade.com` → `localhost:8081`); staging is at `/home/pi/poke4trade-staging` on port 8082 (LAN-only at `http://10.0.0.208:8082`). Both are supervised by **systemd**: `poke4trade.service` and `poke4trade-staging.service`. Each is a git checkout — `git fetch && reset --hard` is the deploy mechanism.

### Day-to-day flow (from your dev machine)

All four commands wrap SSH into pinas. Edit the constants at the top of `scripts/from-dev.sh` if pinas's address ever changes.

| Command | What it does |
|---|---|
| `./scripts/from-dev.sh deploy-staging` | Pull `staging` on pinas, `npm ci`, `npm run build`, restart `poke4trade-staging.service`, hit `/health`. |
| `./scripts/from-dev.sh promote` | Fast-forward `main` → `origin/staging`, tag `prod-YYYYMMDD-HHMM`, push, deploy to prod dir, restart `poke4trade.service`, hit `/health`. |
| `./scripts/from-dev.sh rollback [tag]` | Check out an earlier `prod-*` tag in the prod dir. No arg = list recent tags and prompt. |
| `./scripts/from-dev.sh logs [staging\|prod]` | `journalctl -f -n 50` on the chosen unit. |
| `./scripts/from-dev.sh status` | `systemctl status` for both units + last 20 lines of `~/poke4trade-deploy.log`. |
| `./scripts/from-dev.sh refresh-staging-db` | Re-seed `poke4trade_staging` from a fresh `mysqldump` of `poke4trade`. Destructive against the staging schema. |

The actual logic lives in `scripts/deploy-staging.sh`, `scripts/promote-to-prod.sh`, `scripts/rollback-prod.sh`, and `scripts/refresh-staging-db.sh` — all of which run *on pinas*, not on the dev machine. Each appends `[date] <env> <sha> OK|FAIL …` to `~/poke4trade-deploy.log` on pinas, so `status` shows recent history.

### How env reaches the running process

Three layered sources (later overrides earlier):

1. **Repo `.env`** (loaded by `dotenv` from the checkout's root). Holds Stripe / PayPal / SMTP secrets. Gitignored. Same filename in prod and staging dirs; the values differ. `.env.staging.example` documents the staging variant.
2. **Systemd `Environment=` directives** in the unit file. Prod's unit currently sets `NODE_ENV=production` and the Zoho `SMTP_*` values directly; staging's unit sets `NODE_ENV=production`, `PORT=8082`, `DB_NAME=poke4trade_staging`. `dotenv` does **not** override existing `process.env`, so systemd wins for any key set in both places.
3. **Per-deploy runtime file** at `<repo>/.env.runtime`, written by the deploy/promote/rollback scripts each run with `COMMIT_SHA=<sha>`. The systemd unit picks it up via `EnvironmentFile=-/home/pi/.../env.runtime`. `/health`'s `commit` field reflects this.

For prod's `/health` to report a commit instead of `"unknown"`, the prod systemd unit needs `EnvironmentFile=-/home/pi/poke4trade/.env.runtime` added once (the staging unit at `deploy/poke4trade-staging.service` already has it). Until you add that line, prod still deploys correctly — the health check only requires HTTP 200, not a specific commit value.

### DB strategy

Prod and staging share one MariaDB instance, separate schemas:
- `poke4trade` — prod
- `poke4trade_staging` — seeded once from prod, refreshed on demand via `refresh-staging-db`

The staging schema is reachable by the same `poke4trade` MySQL user used by prod (grant once at bootstrap). The `DB_NAME` switch happens entirely via the staging systemd unit's `Environment=DB_NAME=poke4trade_staging` — `server/database.js` reads it.

### Production / host notes

- Production host: Raspberry Pi (`pinas`), Debian Bookworm, Node 18.20.4, MariaDB 10.11. `/home/pi` has ~48 GB free.
- Production domain: `poke4trade.com` (hardcoded in email-template CTAs in `server/index.js`).
- HTTPS: self-managed cert at `ssl/key.pem` + `ssl/cert.pem` on port 8443. Cloudflare tunnel only ingests HTTP 8081, so 8443 is effectively LAN-only.
- SMTP: Zoho at `smtp.zoho.com:465` as `admin@poke4trade.com`, configured via `Environment=` in `poke4trade.service`. (Note: those values are also present in `.env` but the systemd values win — the `.env` SMTP_* entries are effectively dead.)
- The `poke4trade-watch.service` systemd unit runs `watch.sh` on prod, rebuilding `public/dist/js/` whenever `public/js/` changes. This is legacy and races with deploy-time `npm run build`; consider disabling it once the deploy pipeline is proven (`sudo systemctl disable --now poke4trade-watch.service`).
- A separate `sudoers` rule or `NOPASSWD` is required so the `pi` user can run `systemctl restart poke4trade.service`, `systemctl restart poke4trade-staging.service`, `mysql`, and `mysqldump` non-interactively in the scripts. Bootstrap covers this (see `/etc/sudoers.d/poke4trade-deploy`).
- The `deploy/poke4trade-staging.service` file in this repo is the *template*; it must be `cp`'d to `/etc/systemd/system/` and `systemctl daemon-reload`'d once during bootstrap. The scripts don't install it.
