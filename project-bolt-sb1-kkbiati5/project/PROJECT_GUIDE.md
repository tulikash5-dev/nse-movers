# NSE Movers — Project Guide

Educational Indian-equity screening dashboard. It stores daily NSE gainers and losers, then layers research tools (screener, CHOCH, rounding-bottom scanner, volume alerts, sectors, IPO table, trade list). It is **not** a broker, and it is **not** investment advice.

Application root: this `project/` folder.

---

## Architecture

```
Browser (Vite + React 18 + TypeScript + Tailwind)
    │  VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
    ├─► Supabase Postgres (PostgREST)  — reads/writes tables
    └─► Edge Functions (Deno)          — fetch, delete, proxy, verify, scan
              │
              ├─► NSE CM bhav-copy ZIP (official EOD)
              ├─► Yahoo Finance chart API (OHLCV)
              └─► service_role writes + pg_cron (weekday IST jobs)
```

**Frontend.** SPA with `react-router-dom`. No global store: each page uses `useState` / `useEffect`. The shared client is `src/lib/supabase.ts`. Some pages also `fetch()` Edge Function URLs with the anon key.

**Backend.** Single-tenant Supabase project. There is no login. RLS is enabled on every table. Core mover tables were later restricted so only `service_role` can write; many later tables still allow anon full CRUD.

**Jobs.** `pg_cron` + `pg_net` POST to Edge Functions after NSE close (weekdays). All functions currently have `verify_jwt = false` in `supabase/config.toml`.

**Time zone.** Market dates and clocks use Asia/Kolkata (IST). Fetch jobs assume bhav copy is published ~4:30–5:30 PM IST.

### Request flow (Today’s movers)

1. UI loads `stock_movers` for today’s IST date (or the latest available date).
2. User clicks **Fetch Now** → `POST /functions/v1/fetch-stock-data`.
3. Function downloads the NSE CM bhav-copy ZIP, keeps **CM + EQ** rows, computes `%` vs previous close, filters by `app_settings.threshold_pct` (default 3%).
4. Upserts `stock_movers` on `(date, symbol)` and logs `scheduler_runs`.

### Data sources by feature

| Feature | Live market data? | Notes |
|---|---|---|
| Today / History | Yes (EOD) | Official NSE bhav copy |
| Intraday Screener | EOD only | Scores `stock_movers`; ATR/trend/news are approximated |
| Volume Finder / Sectors | Yes (daily) | Yahoo via `yahoo-finance-proxy` |
| Trade Today verification | Yes (daily) | Yahoo highs/lows vs target and stop |
| CHOCH | Optional | Defaults to simulated random walk; Yahoo/Zerodha stubs exist |
| Scanner / Pattern / Backtest | Demo | Seeded synthetic candles (US + a few NSE names) |
| IPO current price | Simulated | Jitter on stored `current_price`; static fields stay in DB |

---

## Folder structure

```
project/
├── index.html                 # SPA shell
├── package.json               # vite, react, supabase-js, tailwind
├── vite.config.ts
├── tailwind.config.js
├── tsconfig*.json
├── .env                       # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (local)
├── src/
│   ├── main.tsx               # React mount
│   ├── App.tsx                # Routes
│   ├── index.css              # Tailwind
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── StockTable.tsx     # Sortable movers + delete + add-to-trade
│   │   └── CandlestickChart.tsx
│   ├── pages/                 # One file per route (see table below)
│   └── lib/
│       ├── supabase.ts        # Anon browser client
│       ├── types.ts           # StockMover, SchedulerRun, AppSetting
│       ├── tradeList.ts       # Cross-page trade inbox (1:2 target)
│       ├── liveMarketProvider.ts  # Simulated / Yahoo / stub Zerodha
│       ├── intradayScreener.ts    # EOD heuristic score
│       ├── chochDetector.ts       # Swings, CHOCH, BOS, OB, FVG
│       ├── scanner/               # Rounding-bottom detector (client)
│       └── volumeScanner/         # MA/RSI/ATR volume engine + watchlist
└── supabase/
    ├── config.toml            # Function JWT flags
    ├── migrations/            # Schema + cron (apply in filename order)
    └── functions/             # Deno Edge Functions
        ├── fetch-stock-data/
        ├── fetch-ipo-data/
        ├── run-scanner-scan/
        ├── yahoo-finance-proxy/
        ├── delete-stock-mover/
        ├── verify-recommendations/
        └── verify-trade-targets/
```

### Routes (`src/App.tsx`)

| Path | Page | Role |
|---|---|---|
| `/` | `Home.tsx` | Today’s gainers/losers, fetch, backfill, filters |
| `/history` | `History.tsx` | Date range, sectors, multi-day streaks |
| `/settings` | `Settings.tsx` | Threshold, scheduler flag, run log, live-data provider |
| `/screener` | `IntradayScreener.tsx` | Score EOD movers for “intraday” candidates |
| `/choch` | `ChochDetector.tsx` | Change of character / SMC-style structure |
| `/scanner` | `Scanner.tsx` | Rounding-bottom scan (demo candles in UI) |
| `/scanner/:id` | `PatternDetail.tsx` | Pattern chart and metrics |
| `/backtest` | `Backtesting.tsx` | Walk-forward on demo series |
| `/volume-finder` | `VolumeFinder.tsx` | Watchlist volume/MA signals + accuracy history |
| `/sectors` | `Sectors.tsx` | Power / infra / manufacturing groups |
| `/trade-today` | `StocksToTrade.tsx` | User picks, notes, target status |
| `/ipo` | `IpoAnalysis.tsx` | IPO catalog, subscription, quarterly, promoters |

---

## APIs

Base URL: `{VITE_SUPABASE_URL}` (example pattern: `https://<ref>.supabase.co`).

Browser calls use:

```http
Authorization: Bearer <VITE_SUPABASE_ANON_KEY>
Content-Type: application/json
```

CORS on functions is `Access-Control-Allow-Origin: *`. OPTIONS is handled on every function.

### 1. PostgREST (tables)

The UI talks to tables directly via `@supabase/supabase-js`:

- `from("stock_movers").select(...)`
- `from("scheduler_runs")`, `app_settings`
- `from("volume_recommendations").insert(...)`
- `from("trade_list")` via `src/lib/tradeList.ts`
- `from("ipo_listings")`, `ipo_quarterly_results`, `ipo_promoter_holdings`
- `from("scanner_scan_jobs")`, `scanner_pattern_detections`, `scanner_settings`

Anon **SELECT** is allowed on all of these. Writes:

- `stock_movers`, `scheduler_runs`, `app_settings` — **service_role only** (after migration `20260617140530`). The UI must not upsert movers/settings with the anon client; deletes go through `delete-stock-mover`. Settings save currently still upserts `app_settings` with anon (will fail unless policies were changed in the live project).
- Scanner / IPO / volume / trade tables — anon INSERT/UPDATE/DELETE still allowed (single-tenant design).

### 2. Edge Functions

All live under `/functions/v1/<name>`.

#### `POST /functions/v1/fetch-stock-data`

Ingest NSE EOD movers.

**Body**

```json
{
  "triggered_by": "manual" | "scheduler",
  "backfill": false,
  "backfill_from": "YYYY-MM-DD",
  "backfill_to": "YYYY-MM-DD"
}
```

- Normal: try today IST, then up to 4 prior weekdays. Skip weekends. Skip days with ≤500 EQ rows (holiday heuristic).
- `backfill: true`: fill missing weekdays from last DB date (or last 30 days) to today. Optional explicit range.

**Success (normal)**

```json
{
  "success": true,
  "run_id": "uuid",
  "date": "YYYY-MM-DD",
  "threshold": 3,
  "stocks_fetched": 2000,
  "gainers_count": 120,
  "losers_count": 80,
  "data_source": "NSE CM Bhav Copy (today)",
  "message": "..."
}
```

Uses `SUPABASE_SERVICE_ROLE_KEY` internally. External source: `nsearchives.nseindia.com` CM bhav ZIP.

#### `POST /functions/v1/delete-stock-mover`

```json
{ "id": "<stock_movers uuid>" }
```

Returns `{ "success": true, "id": "..." }`. Unauthenticated besides the anon bearer; any caller who can hit the function can delete a mover row.

#### `GET /functions/v1/yahoo-finance-proxy`

Query params:

| Param | Default | Meaning |
|---|---|---|
| `symbol` | required | `RELIANCE` or `RELIANCE.NS` (`.NS` appended if missing) |
| `interval` | `15m` | Yahoo interval |
| `range` | `5d` | Yahoo range |

**Response**

```json
{
  "symbol": "RELIANCE",
  "yahooSymbol": "RELIANCE.NS",
  "meta": { "currency": "INR", "exchange": "...", "regularMarketPrice": 0 },
  "candles": [
    { "time": "10:15 am", "timestamp": 1710000000, "open": 0, "high": 0, "low": 0, "close": 0, "volume": 0 }
  ]
}
```

Used by Volume Finder, Sectors, and CHOCH (Yahoo path).

#### `POST /functions/v1/run-scanner-scan`

```json
{ "triggered_by": "scheduler_primary", "settings": {} }
```

Creates `scanner_scan_jobs`, runs rounding-bottom detection on **demo instruments/candles** (same generator as the UI), writes `scanner_pattern_detections` and high-confidence `scanner_alerts`.

#### `POST /functions/v1/fetch-ipo-data`

No required body. For each active `ipo_listings` row, applies a small simulated price move and recomputes `current_gains_pct`. Marks listings from the last 7 days as `is_new`. Does **not** scrape NSE for new IPOs.

#### `POST /functions/v1/verify-recommendations`

Loads `volume_recommendations` with `status = PENDING` and scan_date at least one calendar day old. Fetches Yahoo `1d` / `5d`, compares next close vs entry and stop → `CORRECT` | `WRONG` | `STOPPED`.

#### `POST /functions/v1/verify-trade-targets`

Loads `trade_list` with `target_status = PENDING` and a `target_price`, created ≥1 day ago. Walks Yahoo daily high/low after `created_at` → `TARGET_HIT` | `STOP_HIT` | `EXPIRED`.

### 3. Cron (pg_cron, weekdays)

Times below are IST.

| IST | UTC cron | Function |
|---|---|---|
| 5:00 PM | `30 11 * * 1-5` | `fetch-stock-data`, `fetch-ipo-data` |
| 5:30 PM | `0 12 * * 1-5` | `run-scanner-scan` (primary) |
| 6:00 PM | `30 12 * * 1-5` | `fetch-stock-data` backup, `verify-recommendations` |
| 6:30 PM | `0 13 * * 1-5` | `run-scanner-scan` backup, `verify-trade-targets` |

Jobs call `net.http_post` with the project URL and anon JWT. Prefer storing URL/key as database settings rather than committing them in SQL.

---

## Stock screener logic

There are **several** screeners. They do not share one engine.

### A. Daily movers filter (Home / History)

Not a score. After bhav ingest:

- **Gainer** if `pct_change >= threshold_pct`
- **Loser** if `pct_change <= -threshold_pct`

UI then filters by price band (default ₹200–₹300) and absolute % (default 5%). History adds streak detection across consecutive dates.

### B. Intraday Screener (`src/lib/intradayScreener.ts`)

Runs **in the browser** on `stock_movers` rows. It does **not** use 5m/15m candles. Timeframe in settings is UI-only.

`scoreStock(stock, settings)` — max **100** points.

| Criterion | Points | Must pass? | How it is computed |
|---|---|---|---|
| Liquidity | 20 | Yes | `volume >= minVolume` (default 1,000,000) |
| Volatility | 25 | Yes | Simulated ATR = `|pct_change| * 0.75`; wants ~2–5% day move and ATR ≥ `minATR` (default 1.5%) |
| Trend | 25 | Yes | Sign of `pct_change` (`< 0.5%` → ranging → fail) |
| Momentum | 15 | Yes | Volume vs “avg” (`volume * 0.8`) and `|pct_change|` |
| Catalyst | 10 | No | Deterministic fake news from symbol char-code hash |
| Beta | 5 | No | Hardcoded map; unknown symbols = 1.0 |

**YES** only if all must-pass criteria succeed **and** `score >= minScore` (default 70).

YES names get a 1% entry band, 2% stop, 3% target from last EOD price.

`detectGapStocks`: `|pct_change| ≥ 2%`; “breakouts” = volume > 1M and `|pct_change| ≥ 3%` (still EOD, not opening gaps).

### C. Volume Trade Finder (`src/lib/volumeScanner/`)

Real **daily** OHLCV from Yahoo (watchlist ~130 NSE names). Evaluates the **latest closed bar** only (no look-ahead).

Defaults (`DEFAULT_VOLUME_SETTINGS`): fast MA 10, slow MA 50, RSI 14, volume MA 20, ATR 14, min avg volume 5,000,000, volume ratio ≥ 1.0, RSI 70/30, 2× ATR stop, 1% risk, 1:2 target.

Decision order:

1. **NO_TRADE / low_liquidity** if 20-day avg volume &lt; minimum.
2. **NO_TRADE / no_trend** if `|fast − slow| / slow < maTolerancePct` (0.5%) and no cross.
3. **NO_TRADE / volume_fade** if price moved but volume ratio &lt; threshold.
4. **LONG** if golden cross **or** (uptrend and close &gt; slow MA), up-volume confirm, RSI not blocked.
5. **SHORT** if death cross **or** (downtrend and close &lt; slow MA), down-volume confirm, RSI not blocked.
6. **NO_TRADE / conflict** if trend and RSI extreme disagree with price vs slow MA.

LONG/SHORT rows can be inserted into `volume_recommendations` (`PENDING`). Next session `verify-recommendations` marks outcome from the next daily close vs stop.

### D. Rounding-bottom scanner (`src/lib/scanner/` + `run-scanner-scan`)

Searches OHLC windows for a U-shape:

- Prior decline ≥ `minPriorDeclinePct` (default 20%).
- Trough in the middle of the window.
- Smoothed closes vs ideal U (`maxShapeError` 0.15).
- Base duration, left/right symmetry, reject V-shape (one candle &gt; 35% of recovery).
- Score: prior decline, shape, symmetry, plus RSI/volume/breakout extras.
- Status: `forming` | `near_breakout` | `breakout_confirmed` | `breakout_retest` | `failed`.

**Important:** both the Scanner page and the cron function currently call `generateDemoCandles()`, not NSE history. Backtest walk-forward uses the same synthetic series.

### E. CHOCH (`src/lib/chochDetector.ts`)

On a candle series: swing highs/lows → market structure → CHOCH / BOS, order blocks, fair-value gaps, ATR, optional Fibonacci. Live quotes depend on `liveMarketProvider` (simulated by default).

---

## Database structure

Migrations live in `supabase/migrations/` and apply in timestamp order.

### `stock_movers`

Daily threshold movers. Unique `(date, symbol)`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| date | date | IST trading date |
| symbol | text | Yahoo-style, e.g. `RELIANCE.NS` |
| company_name | text | Lookup table in fetch function; else ticker |
| exchange | text | Default `NSE` |
| price, prev_close | numeric | Close and previous close |
| pct_change | numeric | ((close − prev) / prev) × 100 |
| volume | bigint | |
| sector, industry | text | Sector from hardcoded map; industry usually null |
| mover_type | text | `gainer` \| `loser` |
| created_at | timestamptz | |

Indexes: `date`, `mover_type`, `sector`, `pct_change`.

**RLS:** anon SELECT; INSERT/UPDATE/DELETE `service_role` only.

### `scheduler_runs`

| Column | Type |
|---|---|
| id | uuid PK |
| run_at | timestamptz |
| status | `success` \| `failed` \| `running` \| `partial` |
| message | text |
| stocks_fetched, gainers_count, losers_count | int |
| threshold_used | numeric |
| triggered_by | `scheduler` \| `manual` |

**RLS:** anon SELECT; writes `service_role`.

### `app_settings`

Key-value. Seeded: `threshold_pct` = `3`, `scheduler_enabled` = `true`, `last_fetch_date` = `''`. Optional `live_data_provider` JSON from Settings (provider + API keys).

**RLS:** anon SELECT; writes `service_role`. `scheduler_enabled` is stored but `fetch-stock-data` does not currently skip when it is false.

### Scanner tables

| Table | Purpose |
|---|---|
| `scanner_instruments` | Symbol master |
| `scanner_candles` | OHLCV per symbol + timeframe; unique `(symbol, timeframe, timestamp)` |
| `scanner_scan_jobs` | Job status, counts, settings jsonb |
| `scanner_pattern_detections` | Pattern metrics, score_breakdown jsonb, FK scan_job |
| `scanner_timeframe_confirmations` | Per-TF row per detection |
| `scanner_alerts` | Fired alerts |
| `scanner_settings` | Scanner KV |
| `scanner_backtest_results` | Stored backtest rows (UI backtest is mostly in-memory) |

**RLS:** anon + authenticated full CRUD.

### IPO tables

- `ipo_listings` — unique `symbol`; issue/listing/current prices; QIB/NII/RII/total subscription; `is_new`, `is_active`.
- `ipo_quarterly_results` — unique `(symbol, quarter)`, FK `ipo_id`.
- `ipo_promoter_holdings` — unique `(symbol, quarter)`.

**RLS:** anon full CRUD.

### `volume_recommendations`

| Column | Notes |
|---|---|
| scan_date, ticker, action | `LONG` \| `SHORT` |
| signal_type, entry_price, suggested_stop | From alert engine |
| volume_ratio, rsi, change_pct, message | |
| status | `PENDING` \| `CORRECT` \| `WRONG` \| `STOPPED` |
| verification_date, verification_price, pnl_pct | Filled by verify job |

**RLS:** anon full CRUD.

### `trade_list`

| Column | Notes |
|---|---|
| ticker, direction | `LONG` \| `SHORT` |
| source | e.g. `movers`, `volume-finder` |
| entry_price, suggested_stop | |
| target_price | 1:2 RR from entry/stop unless overridden |
| target_status | `PENDING` \| `TARGET_HIT` \| `STOP_HIT` \| `EXPIRED` |
| target_checked_at, notes, created_at | |

**RLS:** anon full CRUD.

### Entity relationships (logical)

```
app_settings                    (standalone KV)
scheduler_runs                  (one row per fetch)
stock_movers                    (many per date)

scanner_scan_jobs 1──* scanner_pattern_detections
                         └── * scanner_timeframe_confirmations
scanner_alerts                  (denormalized fire log)

ipo_listings 1──* ipo_quarterly_results
             1──* ipo_promoter_holdings

volume_recommendations          (standalone, verified in place)
trade_list                      (standalone, verified in place)
```

---

## Deployment process

This is a **static frontend** plus a **Supabase** project (database, Edge Functions, cron). There is no custom Node server.

### 1. Local frontend

```bash
cd project
cp .env.example .env   # if you maintain one; otherwise create .env
# .env must contain:
#   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon jwt>
npm install
npm run dev            # http://localhost:5173
```

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`, `npm run lint`.

Vite inlines `VITE_*` at **build** time. Changing env requires a rebuild.

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Enable extensions used by migrations: `pg_cron`, `pg_net` (typically Pro; cron will no-op or fail without them).
3. Link the CLI (from `project/`):

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push                 # apply supabase/migrations
npx supabase functions deploy        # deploy all functions under supabase/functions
```

Or deploy one function:

```bash
npx supabase functions deploy fetch-stock-data
```

4. Confirm function secrets (set automatically on hosted Supabase):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

5. After `db push`, check **Database → Extensions / Cron** that weekday jobs exist. If an older migration used `current_setting('app.supabase_url')` and jobs never fired, later migrations hardcoded URL + anon key — update those jobs to the **current** project URL/key, or set GUCs and point cron at them.

6. `supabase/config.toml` sets `verify_jwt = false` on every function so cron and the SPA can call them with the anon key (or no user JWT). Tighten this before exposing the project widely.

### 3. Host the SPA

`npm run build` emits `dist/`. Host that folder on any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, Bolt, S3+CDN).

Set the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host’s build environment.

SPA routing: all paths must fall back to `index.html` (Vite `BrowserRouter`).

### 4. First-run data

1. After market close IST, call **Fetch Now** on Home or wait for the 5 PM cron.
2. If history has gaps, **Backfill Missing Days** (`backfill: true`).
3. Volume Finder / Sectors need Yahoo proxy working (Yahoo may rate-limit).
4. IPO table needs rows already in `ipo_listings`; the fetch function only nudges prices.

### 5. Operational notes

- **Bhav copy** is not available before ~4:30 PM IST on weekdays; early fetches fail or roll back up to 4 sessions.
- **Anon key is public** in the browser. Do not store broker secrets in `app_settings` if the table is world-readable.
- **No automated tests** are in the repo. Smoke-test: Home load, Fetch Now, Volume scan, add to Trade Today.
- Rotate keys if they were committed in SQL cron jobs; treat the anon JWT as public but keep **service_role** only in Edge Function env.

---

## Quick map for new contributors

| You want to… | Start here |
|---|---|
| Change mover ingest | `supabase/functions/fetch-stock-data/index.ts` |
| Change Home filters | `src/pages/Home.tsx` |
| Change EOD screener score | `src/lib/intradayScreener.ts` |
| Change volume LONG/SHORT rules | `src/lib/volumeScanner/alertEngine.ts` |
| Change rounding-bottom shape | `src/lib/scanner/detector.ts` **and** `run-scanner-scan` (duplicated) |
| Add a page | `src/pages/*`, `App.tsx`, `Navbar.tsx` |
| Add a table | new file under `supabase/migrations/` |
