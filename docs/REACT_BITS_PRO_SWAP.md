# React Bits Pro swap

> **STATUS: HISTORICAL REFERENCE — SUPERSEDED FOR CURRENT INKUBATOR AUTHORITY.**
>
> Canonical licensing/build-boundary requirements now live under [`docs/inkubator/INDEX.md`](./inkubator/INDEX.md), especially `ARCHITECTURE_CONSTITUTION_V0.md` and `CURRENT_STATE_AND_GAP_V0.md`.
>
> The current Inkubator feature branch contains generated/installed `apps/inkubator-lab/src/components/react-bits/*.tsx` source, so the earlier assumption below that private Pro source was absent from the repository must not be treated as current fact. Platform Foundation F0 must resolve the applicable license/public-source/history boundary before production release.

This repository originally contained a working `GrainField` fallback because the private React Bits Pro registry/license was not available to the execution environment used for that phase.

The intended adapter principle remains useful:

```tsx
<AmbientBackground quality={quality} reduced={reduced} />
```

A licensed/private implementation should sit behind a stable Inkubator-owned adapter rather than leaking proprietary implementation details or credentials throughout feature code.

Required controls to preserve for any atmospheric implementation:

- bounded quality modes appropriate to the current app;
- reduced-motion/static fallback;
- hidden-tab/offscreen pause where applicable;
- DPR/resolution cap;
- route-level isolation so Broadcast effects do not enter the Command critical path.

Do not expose registry/license credentials in Git, prompts, public CI logs, browser bundles or published SDKs.

Before choosing any licensed Pro component as a production dependency, benchmark it against the allowed fallback/alternative under the same performance and accessibility gates and confirm the public-source/build process is license-compliant.