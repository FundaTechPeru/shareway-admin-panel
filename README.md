# shareway-admin-panel

Administration panel of **ShareWay**, the university platform for scheduled shared rides with
verified drivers (UPC, SI657 Fundamentos de Arquitectura de Software). It is the console the
operations staff uses to watch the platform, verify drivers, look up trip records and close
settlements, in front of the
[API gateway](https://github.com/FundaTechPeru/shareway-api-gateway).

The panel has no business logic and no data of its own beyond the audit trail of the lookups.
Every action travels to a service through the gateway with the token of the administrator who is
signed in, so the services keep deciding what is allowed.

Node.js 22 · Express 5 · TypeScript (strict) · better-sqlite3 · helmet · pino · vitest and
supertest · Angular 20 (standalone components and signals).

## Shape

```text
browser ──► /panel-api/** ──► BFF (Express) ──► API gateway ──► ShareWay services
   ▲                            │
   └── the built SPA ───────────┤
                                └──► SQLite: audit trail of the trip record lookups
```

Two workspaces:

- `server/` — the BFF, the only API the browser talks to. It forwards the `Authorization` header
  of the administrator as it came, so the gateway and the services validate the token again.
- `frontend/` — the single page application. The interface is in Spanish; the code, like the rest
  of the repository, is in English.

The browser never calls the gateway and never learns its URL: the BFF is reached at `/panel-api`
through the dev server proxy while developing, and from the same origin in production, where this
process also serves the built SPA.

## Screens

| Screen | Route | User story | Reads |
|---|---|---|---|
| Sign in | `/login` | — | `POST /panel-api/login` |
| Services | `/servicios` | US-34 | `GET /panel-api/health` every 30 s |
| Driver verification | `/conductores` | US-35 | pending documents; review of one document |
| Trip records | `/registro` | US-36 | lookup by trip, driver or passenger |
| Audit trail | `/registro/bitacora` | US-37 | the lines of the lookups, and their CSV |
| Settlements | `/liquidaciones` | US-25 | settlements by status; mark one as paid |

Only `ADMIN` enters: the BFF answers 403 to anybody else, the panel says «Acceso solo para
personal autorizado» and no screen opens. The token lives in memory and is mirrored in
`sessionStorage`, so a reload keeps the session and closing the tab ends it. Any 401 from the BFF
closes the session and sends the browser back to `/login`.

Two rules the screens cannot skip:

- **A lookup needs a reference.** The trip record screen does not search without the reference of
  the requirement that justifies it, and the BFF writes the line in the audit trail **before** it
  searches: a lookup that fails was still a lookup.
- **The audit trail is read only.** There is no route that edits or removes a line, and the
  repository behind it only appends and reads.

## Panel API

Everything under `/panel-api` except the sign in needs a `Bearer` token of an `ADMIN`.

| Method and path | Goes to | Notes |
|---|---|---|
| `POST /panel-api/login` | `POST /api/v1/auth/login` | Public. Answers `{token, admin}`; 403 for anyone who is not staff |
| `GET /panel-api/health` | `GET /health` of the gateway | Circuit of each service as `OPERATIONAL`, `RECOVERING`, `DOWN`, `NOT_CONFIGURED` or `UNKNOWN` |
| `GET /panel-api/pending-documents` | `GET /api/v1/driver-documents?status=PENDING` | Real with `FEATURE_REAL_PENDING_DOCS=true`; mock while it is off |
| `PATCH /panel-api/driver-documents/:id/review` | the same path on the service | `{decision, reason}`; the reason is required to reject; 409 if it was already reviewed |
| `GET /panel-api/trip-records` | `GET /api/v1/trips/admin` | `reference` plus one of `tripId`, `driverId`, `passengerId` (mapped to `conductorId`/`pasajeroId`); writes the audit line first. Driver name and vehicle are composed from Driver Management. Real with `FEATURE_REAL_TRIP_RECORDS=true`; mock while it is off |
| `GET /panel-api/trip-records/:id` | the same path on the service | `reference` required; writes the audit line first |
| `GET /panel-api/audit-log` | the SQLite file of the panel | `from`, `to`, `limit` |
| `GET /panel-api/audit-log.csv` | the SQLite file of the panel | Same filters; CSV with a Spanish header for the staff |
| `GET /panel-api/settlements` | `GET /api/v1/admin/settlements` | `status=PENDING\|PAID`, or every settlement with no status |
| `PATCH /panel-api/settlements/:id/mark-paid` | the same path on the service | Answer handed back as it came, 409 included |
| `GET /health` | — | Liveness of the panel itself, for the container probe. No token |

Answers of the services are handed to the browser as they came, status code included: the panel
does not reshape a 409 or a validation error. Its own errors use the body the platform shares,
`{timestamp, status, error, message, path, fieldErrors}`.

## What is real and what is mock

| Capability | Source |
|---|---|
| Sign in, status of the platform, document review, settlements | **Real**: endpoints that already exist behind the gateway |
| Pending documents (`GET /api/v1/driver-documents?status=PENDING`) | **Real** now that Driver Management ships the list: set `FEATURE_REAL_PENDING_DOCS=true` (the mock stays for development without a backend) |
| Trip records (`GET /api/v1/trips/admin`) | **Real** now that Trip Execution ships the admin lookup: set `FEATURE_REAL_TRIP_RECORDS=true` (the mock stays for development). The driver name and vehicle are composed from Driver Management per row |
| Audit trail of the lookups | **Real**, owned by the panel: SQLite behind a repository |

Each of the two endpoints that do not exist yet lives behind an adapter with the same interface
(`server/src/adapters/`): the mock seeds a handful of believable documents and trips, and turning
its flag on sends the very same call to the gateway. Every answer carries `source: "mock"` or
`source: "gateway"`, and the screens show a «Datos de ejemplo» badge while the data is seeded, so
nobody mistakes a demo for production.

## Running locally

Prerequisites: Node.js 22.15 or later (see `.nvmrc`), and a gateway to talk to.

```bash
npm install
GATEWAY_URL=http://localhost:8000 npm run dev
# BFF on http://localhost:8090, SPA on http://localhost:4200
```

`npm run dev` starts both workspaces; the Angular dev server proxies `/panel-api` to the BFF
(`frontend/proxy.conf.json`), so the browser only ever sees its own origin.

As one process, the way it ships:

```bash
npm run build
GATEWAY_URL=http://localhost:8000 npm start   # panel on http://localhost:8090
```

The BFF serves the built SPA from `WEB_ROOT` and sends every path that is not `/panel-api/**` to
`index.html`, so the routes of the panel work on a reload.

With Docker:

```bash
docker compose up --build                     # panel on http://localhost:8090
```

`docker-compose.yml` is an example: point `GATEWAY_URL` at your gateway. The image builds both
workspaces, runs as an unprivileged user and keeps the audit trail in the `panel-data` volume.

### Configuration

Read by the BFF (`server/src/config.ts`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8090` | HTTP port |
| `GATEWAY_URL` | none, required | Base URL of the ShareWay API gateway |
| `GATEWAY_TIMEOUT_MS` | `10000` | Time without an answer from the gateway before giving up |
| `HEALTH_TIMEOUT_MS` | `3000` | Shorter budget for the status screen, so it always paints |
| `DB_FILE` | `./data/panel.db` | SQLite file with the audit trail (`:memory:` in the tests) |
| `FEATURE_REAL_PENDING_DOCS` | `false` | `true` sends the pending documents to the gateway instead of the mock. Driver Management ships the list, so **production should set it to `true`** (`docker-compose.yml` already does) |
| `FEATURE_REAL_TRIP_RECORDS` | `false` | `true` sends the trip record lookups to the gateway (`GET /api/v1/trips/admin`) instead of the mock, composing the driver and vehicle from Driver Management. Trip Execution ships the endpoint, so **production should set it to `true`** (`docker-compose.yml` already does) |
| `WEB_ROOT` | `./public` | Folder with the built SPA; ignored while it does not exist |
| `LOG_LEVEL` | `info` | pino level (`silent` turns logs off) |

The panel keeps no secret: it has no `JWT_SECRET`, no credentials of the services and no database
password. It reads the claims of the token it was given to know who is signed in, without
checking the signature, because the gateway and Driver Management already did and will again.

### Audit trail

One SQLite file, created on the first start, with one table of lookups behind
`AuditLogRepository` (`record` and `list`, nothing else). The interface is what the routes depend
on, so moving the trail to PostgreSQL later is another implementation of it. In Docker the file
lives in the `panel-data` volume; `data/*.db` is never committed.

## Health and logs

`GET /health` answers `{"status":"UP"}` and never asks the gateway, so a failing platform never
makes the container unhealthy. The status of the platform is a separate, authenticated route,
`GET /panel-api/health`, and when the gateway does not answer it reports the gateway as `DOWN`
and every service as `UNKNOWN` instead of failing: the screen says «Sin datos».

Logs are JSON lines (pino), one per request with method, URL, status, latency and the id of the
administrator. The `authorization` and `cookie` headers and the password of the sign in are
redacted.

## Tests

```bash
npm test                        # BFF (vitest + supertest) and SPA (vitest + jsdom)
npm run check                   # lint, type check and tests of both workspaces
```

The BFF suites start the app against a fake gateway and cover the mapping of the health report,
the gateway being down, the role guard, the forwarding of the `Authorization` header, the audit
line written before a lookup, the reason required to reject a document and the 409 of a
settlement that was already paid. The SPA suites cover the session, the labels of the status
screen and the three screens with a decision to make: a rejection without a reason, a lookup
without a reference and a settlement that somebody else had already paid.

## Decisions and known issues

- **The browser only talks to the BFF.** It is what keeps the gateway URL, the shape of the
  services and the audit trail out of the client, and what makes one audit line per lookup
  possible at all.
- **The BFF does not verify the signature of the token.** It reads `sub`, `role` and `email` to
  know who is asking and refuses anyone who is not `ADMIN`; the gateway holds the secret and
  checks the signature on every forwarded call.
- **Two endpoints are mocked** and both are read-only lists, so no mock ever writes to a service.
  Nothing else is faked: a document review and a settlement marked as paid always travel.
- The sidebar shows Panel, Verificaciones, Alertas and Usuarios as «próximamente»: the wireframes
  include them and this version does not.
- The Docker image is built by the CI workflow; it was not built on the development machine.

## Contributing

GitFlow: `main`, `develop`, `feature/*` merged into `develop` with `--no-ff`, `release/*` and
SemVer tags. Commits follow [Conventional Commits](https://www.conventionalcommits.org/) in
English (`type(scope): subject`, at most 72 characters). The BFF follows the Google TypeScript
Style (`gts`: ESLint and Prettier) and the SPA the Angular ESLint rules; run `npm run fix` in
`server/` before committing.
