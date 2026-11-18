# Changelog

Versions follow [SemVer](https://semver.org/); the entries are the ones that matter to the
operations staff and to whoever deploys the panel.

## 0.1.0

First version of the administration panel.

### Screens

- Sign in reserved to `ADMIN`; anybody else is told the panel is for authorized staff only.
- **Servicios** (US-34): state of the gateway and of each service, refreshed every thirty
  seconds, with every service «sin datos» while the gateway does not answer.
- **Verificación de conductores** (US-35): review of the documents waiting, with the reason the
  driver reads when one is rejected.
- **Registro de viajes** (US-36): lookup by trip, driver or passenger, always with the reference
  of the requirement that justifies it.
- **Bitácora** (US-37): the lines of those lookups, filtered by period and exported as CSV, read
  only.
- **Liquidaciones** (US-25): settlements by status and the payment marked as made, with the 409
  of a settlement somebody else had already paid.

### Platform

- BFF in Express 5 as the only API the browser talks to; it forwards the token of the
  administrator to the gateway and logs one line per request.
- Audit trail of the lookups in SQLite behind a repository that only appends and reads.
- Pending documents and trip records answered from mocks behind `FEATURE_REAL_PENDING_DOCS` and
  `FEATURE_REAL_TRIP_RECORDS` until the services ship those endpoints.
- Single image with both workspaces, docker-compose example and CI that lints, tests and builds.
