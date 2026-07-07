# Event-Driven Devin

A reproduction of the **Event-Driven AI Remediation** demo: a production
incident automatically starts an AI software engineer (Devin) that investigates
the problem and opens a fix.

It demonstrates one reusable loop:

```
user action → unhandled error → error tracking + metrics/logs
   → chat alert → AI engineer triggered → root cause → pull request
   → status streams back to the thread
```

The app ships with a hub and nine industry "verticals" (retail, banking,
financial services, insurance, CPG, high tech, industrials, healthcare, telco).
Each vertical is a small themed page with a single "primary action" endpoint
that performs a believable business action and then **fails on cue** so the
pipeline has something to react to. Every vertical feeds the same pipeline — the
pipeline is what you are really building.

> ⚠️ **This is a demo.** The apps throw errors on purpose, data is in-memory and
> hard-coded, and there is no auth, validation, or rate limiting. Do not ship
> intentional bugs or copy this line-for-line into production.

## The verticals

| Vertical | Brand | Endpoint | Bug |
| --- | --- | --- | --- |
| Retail eCommerce | ACME Commerce | `POST /api/storefront/checkout` | Promo SKU not in catalog (`undefined.name`) |
| Banking | Apex Bank | `POST /api/banking/transfer` | Falsy-zero fee-rate trap (`undefined.rate`) |
| Financial Services | Meridian Capital | `POST /api/trading/execute` | Fee-tier map key mismatch (`null.fees`) |
| Insurance | Shield Insurance | `POST /api/insurance/claim` | Wrong destructure of a missing record (`null.policy`) |
| CPG | Harvest Goods | `POST /api/cpg/order` | Warehouse lookup in `forEach` (`undefined.code`) |
| High Tech | NovaSoft | `POST /api/licenses/provision` | `indexOf` returns -1 (`undefined.pricePerSeat`) |
| Industrials | Titan Manufacturing | `POST /api/maintenance/workorder` | Category case mismatch (`undefined.rates`) |
| Health Care | CarePoint Health | `POST /api/healthcare/appointment` | Copay schedule off-by-one index (`null.copayAmount`) |
| Telco | WaveConnect | `POST /api/telco/upgrade` | Plan-code regex mismatch (`undefined.monthlyRate`) |

## Architecture

| Layer | Role | This repo |
| --- | --- | --- |
| Web application | Serves UI + API; contains the failing action | Node.js + Express (`server.js`, `src/verticals.js`) |
| Error tracking | Captures exceptions with rich context | `src/pipeline.js` → Sentry (optional via `SENTRY_DSN`) |
| Metrics / logs | Counters + structured JSON logs | `src/logger.js`, `src/pipeline.js` |
| Alert + trigger | On failure, format alert + start the AI | `src/pipeline.js` (`createAlertAndTriggerAI`) |
| Chat | Where humans see alerts + AI progress | Slack webhook (optional via `SLACK_WEBHOOK_URL`) |
| AI software engineer | Investigates and proposes a fix (PR) | Devin API (optional via `DEVIN_API_KEY`) |

When `DEVIN_API_KEY` is unset (or `SIMULATE_PIPELINE=1`), the pipeline runs in
**simulated mode**: it logs the alert and the exact investigation prompt it
would have sent, so the demo is fully browsable without any credentials.

## Run locally

```bash
npm install
npm start            # http://localhost:3000
npm test             # asserts every vertical still fails on cue
```

Copy `.env.example` to `.env` to enable real integrations.

## Endpoints

- `GET /` and `GET /hub.html` — the hub
- `GET /:vertical` — a vertical page (e.g. `/retail`)
- `GET /api/config` — public config (title, locked org/user)
- `GET /api/verticals` — vertical metadata
- `POST /api/resolve-identity` — resolve org/user for session attribution
- `GET /api/admin/session-stats` — rolling-window Devin-session cap stats
- `POST <vertical endpoint>` — the failing primary action

## Deploy

Container-first (`Dockerfile`), configured for Fly.io (`fly.toml`). Pushes to
`main` run tests and deploy via `.github/workflows/fly-deploy.yml` (needs a
`FLY_API_TOKEN` repo secret).
