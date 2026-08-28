# VERCEL_DEMO_V0

Status: DEPLOYMENT_ONLY

Purpose: expose the existing REKT//INK product as one same-origin Vercel demo without changing simulator, Career, provenance, or market semantics.

## Topology

- `web` service: `apps/web/` (Vite/React)
- `api` service: `apps/api/` (Fastify + WebSocket)
- `/health` -> `api`
- `/v1/*` -> `api`
- everything else -> `web`

The browser therefore keeps its existing same-origin HTTP and WebSocket URLs. No frontend API-origin fork is introduced.

## Truth boundary

- `/` remains LIVE-default.
- LIVE provider failures remain fail-closed.
- DEMO remains explicit and SYNTHETIC.
- No LIVE -> DEMO fallback is added.
- No simulator/Career economics or qualification semantics change.

## Deployment acceptance

A deployment is usable only if all of the following hold:

1. `/` serves the Vite app.
2. `/health` returns the Fastify health envelope.
3. `/v1/radar?environment=DEMO` returns SYNTHETIC fixture rows.
4. `/v1/radar?environment=LIVE` either returns LIVE rows or a fail-closed 503; it must never return fixtures under LIVE.
5. `wss://<deployment>/v1/stream?environment=DEMO&symbol=REKT&pair=<fixture-pair>` upgrades and emits DEMO frames, or the browser's already-existing DEMO fallback takes over visibly.
6. Opening additional browser clients does not create per-client upstream provider polling beyond the existing shared-hub design.

This deployment contract does not qualify the real GeckoTerminal mapping. `LIVE_PROVIDER_SMOKE_V0` remains a separate gate before relying on LIVE market evidence.
