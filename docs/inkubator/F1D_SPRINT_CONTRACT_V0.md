# REKT INK(CUBATOR) — F1D Sprint Contract v0

**Status:** LOCKED OPERATIONAL SPRINT CONTRACT

**Base:** `97be2df8341a9e2b42bbf26d355aca8d4158a3d3`

**Phase:** `PLATFORM_FOUNDATION_V0 / F1D`

This document is an execution checkpoint under the canonical roadmap. It does not supersede the canonical authority documents in `docs/inkubator/`.

## Primary falsifiable hypothesis

A minimally privileged GitHub App can accept hostile/replayed GitHub webhook input and produce exactly one safe normalized repository observation for an authenticated Inkubator Player without leaking private source, executing participant code, or creating authority stronger than the observation actually supports.

## Provider surface

F1D supports exactly one work-bearing repository event: `push`.

GitHub App installation lifecycle events needed to maintain installation/repository binding are allowed, but they are integration-control events, not additional product evidence types.

## Installation/authentication decision

GitHub's setup URL includes an `installation_id` that GitHub explicitly warns may be spoofed. Therefore F1D permits a narrowly bounded GitHub user-authorization step only during installation setup to prove that the authenticated Inkubator Player is associated with the installation.

Rules:

- installation flow begins from an authenticated Inkubator session;
- installation URL uses a high-entropy one-time `state` bound to that Player and an expiry;
- setup callback must validate and atomically consume the state;
- the callback exchanges the GitHub authorization code for a temporary user access token and verifies the installation through GitHub's authenticated API;
- the GitHub user token is never persisted and is discarded immediately after installation verification;
- no GitHub user token becomes browser/session/worker/SDK authority;
- ongoing GitHub integration authority is GitHub App installation identity plus signed webhooks, not user OAuth.

## Trusted ingress pipeline

```text
RAW REQUEST BYTES
  -> HMAC-SHA256 VERIFY (`X-Hub-Signature-256`)
  -> HEADER/DELIVERY VALIDATION (`X-GitHub-Delivery`, `X-GitHub-Event`)
  -> JSON PARSE ONLY AFTER SIGNATURE PASS
  -> INSTALLATION + REPOSITORY IDENTITY CHECK
  -> DELIVERY DEDUPE
  -> NORMALIZE
  -> ONE POSTGRES TRANSACTION
       delivery receipt
       + history observation
       + existing outbox work only if required
  -> EXPLICIT PRIVATE/PUBLIC PROJECTION
```

## Required persisted identities

Store immutable numeric GitHub identifiers where relevant:

- GitHub user ID used only as installation-ownership provenance;
- installation ID;
- repository ID.

Mutable GitHub login/name/full-name values are descriptive metadata, never identity keys.

## One normalized product observation

Semantic event:

`github.repository_push.observed.v1`

Minimum normalized meaning:

- provider: GitHub;
- immutable installation ID;
- immutable repository ID;
- delivery GUID;
- git ref;
- before SHA;
- after SHA;
- repository visibility/private flag;
- provider timestamp only when trustworthy and explicitly sourced.

Do not persist arbitrary source files, README text, commit message bodies, patch bodies, or participant instructions as normalized public evidence in F1D.

The event is `OBSERVED`, never `PROVEN`.

## Public/private projection rule

Private product authority may retain the minimum provider identifiers/provenance needed to operate the integration.

Public projection must be constructed explicitly and must not expose raw webhook payloads, private repository names, private source, commit messages, user email, installation credentials, or temporary OAuth material.

## Pre-freeze hostile matrix

The first review candidate may not be frozen until all applicable checks pass:

- [ ] known raw-body HMAC fixture accepted;
- [ ] missing signature rejected;
- [ ] malformed signature rejected;
- [ ] one-byte body mutation rejected;
- [ ] unicode body signature preserved over exact bytes;
- [ ] JSON parsing occurs only after signature verification;
- [ ] unsupported work-bearing event fails closed / produces no observation;
- [ ] missing or malformed delivery GUID rejected;
- [ ] duplicate `X-GitHub-Delivery` produces exactly one authoritative observation;
- [ ] same delivery ID with conflicting payload identity fails closed;
- [ ] installation/repository mismatch produces no observation;
- [ ] repository not bound to installation produces no observation;
- [ ] revoked/removed repository cannot continue producing accepted observations;
- [ ] private webhook fields are absent from public projection;
- [ ] no participant repository content is executed;
- [ ] no GitHub write permission is required;
- [ ] no Redis/Kafka/new queue/new service introduced;
- [ ] worker retry/crash cannot duplicate authoritative observation;
- [ ] real Postgres integration passes;
- [ ] repo typecheck/full tests/canonical build pass.

## Independent review budget

After the pre-freeze hostile matrix passes:

`IMPLEMENT -> TEST -> PRE-FREEZE HOSTILE MATRIX -> FREEZE EXACT SHA -> ONE independent hostile review -> fix Critical/High -> ONE re-review only if Critical/High repair was required -> CLOSE -> MOVE FORWARD`

Medium/Low findings do not restart F1D unless they undermine the phase objective, invalidate evidence, violate a frozen invariant/contract, or create a fail-closed/security defect.

## Explicit non-scope

Do not implement in F1D:

- pull-request intelligence;
- workflow/check/deployment ingestion;
- repository cloning;
- README/source parsing;
- stack detection;
- AI/Daemon;
- PROVEN promotion;
- GitHub write actions;
- generic connector framework;
- Redis/Kafka/queue service;
- verifier/sandbox;
- Mission progress rules;
- broad Mission/Project product UX;
- social/Cheevo/Ship/DevKit work.

## Phase-1 exit immediately after F1D

After F1D closes, implement only the minimal development Mission/Project records necessary to prove:

```text
AUTHENTICATED PLAYER
  -> MINIMAL MISSION
  -> MINIMAL PROJECT
  -> CONNECT SELECTED GITHUB REPOSITORY
  -> REAL/SIGNED PUSH OBSERVATION
  -> SAFE PRIVATE/PUBLIC STATE
  -> REPLAY SAME DELIVERY
  -> STILL EXACTLY ONE AUTHORITATIVE OBSERVATION
```

Then close Platform Foundation v0 and stop platform work. No F1E is authorized.

The next product phase after that exit proof is `PHASE 2 — REKT SIGNAL SYSTEM / FIVE GOLDEN SCREENS`.