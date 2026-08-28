# React Bits Pro swap

This repository contains a working `GrainField` fallback because the private React Bits Pro registry/license is not available to this execution environment.

After you locally install the licensed Pro component, keep the public adapter semantics:

```tsx
<AmbientBackground quality={quality} reduced={reduced} />
```

Replace `apps/web/src/effects/GrainField.tsx` internally with the vendored Pro `GrainWave` source. Do not expose the registry key in Git, Lovable, Qwen, or prompts.

Required controls to preserve:

- `quality`: ULTRA / HIGH / LOW / TERMINAL
- `reduced`: freezes decorative movement
- hidden-tab pause
- DPR/resolution cap

Benchmark Pro GrainWave against the fallback under the same `MANIA` and `PATHOLOGICAL` replay before choosing the default.
