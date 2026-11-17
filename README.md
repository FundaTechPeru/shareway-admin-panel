# shareway-admin-panel

Administration panel of **ShareWay**, the university platform for scheduled shared rides with
verified drivers (UPC, SI657 Fundamentos de Arquitectura de Software). It is the console the
operations staff uses to watch the services, verify drivers, look up trip records and close
settlements.

The panel has no business logic and no database of its own beyond its audit trail: every action
goes through the [API gateway](https://github.com/FundaTechPeru/shareway-api-gateway).

Two workspaces:

- `server/` — BFF in Express 5 and TypeScript; the only API the browser talks to.
- `frontend/` — single page application in Angular; the user interface, in Spanish.
