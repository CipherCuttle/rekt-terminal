# REKT//INK Market Intelligence Terminal

An Ink-native market terminal: dense Dexscreener-style discovery, Lightweight Charts, live Ink head status, provenance-aware wallet/NFT inspection, deterministic replay, and a cool-retro-term inspired visual layer.

## Architecture

- `apps/web`: React 19 + TypeScript + Vite + Lightweight Charts.
- `apps/api`: Fastify + WebSocket API, live Ink RPC/WSS, Dexscreener + GeckoTerminal adapters, deterministic fixture mode.
- `packages/core`: dependency-free replay/sequence primitives used by tests and design validation.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Web: `http://localhost:5173`  
API: `http://localhost:8787`

The UI boots in **FIXTURE** mode so every interaction works without external services. Switch to **LIVE** to use Ink/Dexscreener/GeckoTerminal. Live mode degrades fail-closed when a provider is unavailable.

## React Bits Pro

The proprietary React Bits Pro source is not committed here. `GrainField` is the working, low-cost fallback. See `docs/REACT_BITS_PRO_SWAP.md` for the exact adapter seam to replace it with your vendored Pro `GrainWave` after installing it with your own license locally. Never commit or paste the Pro registry key.

## Safety / truth constraints

- Chain is Ink (`57073`), native currency is ETH.
- Aggregate market APIs never create fake buyer identities.
- NFT transfers are not called sales without payment/marketplace evidence.
- Wallet value is labeled visible onchain value, never net worth.
- Every derived metric carries provenance metadata in the API model.

## CI and specialist frontend workflow

GitHub Actions runs source invariants, deterministic replay checks, TypeScript checks, tests, and a production build on every PR/push. Until a networked machine generates and commits a root `package-lock.json`, dependency versions are pinned exactly and CI uses `npm install --no-audit --no-fund`.

Frontend work uses a specialist loop rather than one permanent "best model":

`spec -> build -> render -> visual red-team -> revise -> engineering review -> commit`

Preferred roles:

- Claude Code + Claude Opus 5: primary design/builder.
- Kimi K3 / `kimi-latest`: independent screenshot/visual red-team.
- Qwen3.8-Max: bounded implementation worker.
- GLM latest coding-capable model: implementation fallback when quotas/cost favor it.
- Codex / GPT-5.6 Sol: engineering authority for performance, state, APIs, TypeScript, tests, accessibility and dependency discipline.

See [`docs/FRONTEND_AGENT_WORKFLOW_V1.md`](docs/FRONTEND_AGENT_WORKFLOW_V1.md) and [`docs/agent-packets/PHASE_PACKET_TEMPLATE.md`](docs/agent-packets/PHASE_PACKET_TEMPLATE.md).

## Product / simulation contracts

- [`docs/PROJECT_PLAN_V1.md`](docs/PROJECT_PLAN_V1.md) — product thesis, 10-stack architecture decisions, MVP and phase plan.
- [`docs/RPS_REUSE_MATRIX_V1.md`](docs/RPS_REUSE_MATRIX_V1.md) — exact Rugpull Tycoon donor/reject matrix bound to commit `80db648a...`.
- [`docs/SIM_CONTRACT_V0.md`](docs/SIM_CONTRACT_V0.md) — deterministic 0.5 ETH spot/perp training accounting contract.
- [`docs/CAREER_CONTRACT_V0.md`](docs/CAREER_CONTRACT_V0.md) — capability progression, first skill tree and qualification rules.
- [`docs/PHASE_0_IMPLEMENTATION_ORDER.md`](docs/PHASE_0_IMPLEMENTATION_ORDER.md) — bounded next implementation phase.
