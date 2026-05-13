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
- `sync-verify.js` at repo root — a separate long-running script (originally for a Raspberry Pi deployment; its `require()` paths point at `/home/pi/poke4trade/`) that does retry-with-Telegram-notification syncing. Tracks state in `server/sync-state.json`.

`scripts/update_tax_rates.js` is a standalone cron job (TaxCloud API → MySQL `tax_rates`), referenced for `/api/tax/*` endpoints.

## Conventions that aren't obvious from the code

- **Card prices** are extracted from the cached TCG JSON blob (`cards.data`) — see `extractTcgPrice` in `index.js` (~line 61) and `getCardMarketPrice` (~line 865). Preference order: `holofoil` → `reverseHolofoil` → `normal` → `1stEditionHolofoil` → `1stEditionNormal` → first available `.market`. Reuse these helpers rather than re-parsing prices inline.
- **Uploads**: profile pictures go to `uploads/profiles/user_<id>.<ext>` (served at `/uploads/...`); product images go to `public/uploads/products/` with random filenames. Multer is configured inline in `index.js`.
- The hardcoded DB password and the Pokémon TCG API key in `server/database.js` and `sync-verify.js` are checked into the repo. Treat this as a known intentional state — don't "fix" by adding env-var indirection unless asked.
