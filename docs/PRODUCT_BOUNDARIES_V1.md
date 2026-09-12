# REKT Product Boundaries V1

Status: **FROZEN REPOSITORY / DEPLOYMENT BOUNDARY**

This monorepo contains two distinct products. Sharing a repository, toolchain, selected packages, or CI does **not** merge their product identity, runtime routing, deployment target, or authority.

## Product A — REKT Terminal

Purpose: trading/career terminal product.

Canonical runtime roots:
- frontend: `apps/web` (`@rekt-ink/web`)
- API: `apps/api` (`@rekt-ink/api`)

Canonical frontend deployment contract:
- product id: `rekt-terminal`
- build: `npm run build:terminal`
- output: `apps/web/dist`
- deployment identity must be distinct from REKT Inkubator

## Product B — REKT Inkubator

Purpose: incubator/community/build/rehearsal product.

Canonical runtime roots:
- frontend: `apps/inkubator-lab` (`@rekt-ink/inkubator-lab`)
- API: `apps/inkubator-api` (`@rekt-ink/inkubator-api`)
- verifier: `apps/inkubator-verifier` (`@rekt-ink/inkubator-verifier`)

Canonical frontend deployment contract:
- product id: `rekt-inkubator`
- build: `npm run build:inkubator`
- output: `inkubator`
- deployment identity must be distinct from REKT Terminal

## Allowed sharing

The products may share:
- repository-level toolchain and lockfile;
- deterministic CI and security checks;
- explicitly reusable packages under `packages/`;
- protocol/schema artifacts when a frozen contract explicitly authorizes it.

Shared code does not imply shared runtime state or product authority.

## Forbidden coupling

The following are repository violations unless a later frozen authority explicitly replaces this contract:
- REKT Terminal frontend or API importing Inkubator application code;
- REKT Inkubator frontend/API/verifier importing REKT Terminal application code;
- one product mounting or routing directly into the other product's application shell;
- using one Vercel project/deployment identity as the canonical deployment for both products;
- relabeling Terminal UI as Inkubator or Inkubator UI as Terminal;
- making Inkubator verifier/reputation/Ship authority part of Terminal simulation/accounting semantics;
- making Terminal market/career simulation state canonical Inkubator truth.

## Monorepo build versus product deploy

`npm run build` remains the repository-wide canonical verification build. It may build both products because CI verifies the whole monorepo.

A production or rehearsal frontend deployment MUST use the product-scoped build contract instead:
- REKT Terminal: `npm run build:terminal`
- REKT Inkubator: `npm run build:inkubator`

A repository-wide `npm run build` is not a deployment identity and must not be treated as one.

## Vercel project rule

When both products are deployed from this monorepo, create two independent Vercel projects:

### `rekt-terminal`
- repository: `CipherCuttle/rekt-terminal`
- build command: `npm run build:terminal`
- output directory: `apps/web/dist`

### `rekt-inkubator`
- repository: `CipherCuttle/rekt-terminal`
- build command: `npm run build:inkubator`
- output directory: `inkubator`

Environment variables, domains, preview URLs, rollback evidence, and deployment receipts are product-specific. Do not reuse one product's deployment receipt as evidence for the other.

## Machine enforcement

`config/product-boundaries.json` is the machine-readable product map.

`npm run verify:product-boundaries` must pass in repository CI. It validates runtime roots, package identities, product-scoped build commands, deployment outputs, and direct cross-product application imports.
