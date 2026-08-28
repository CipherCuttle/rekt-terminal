# LOCAL SETUP

## First run

```bash
unzip rekt-ink-terminal-local-ci.zip
cd rekt-ink-terminal
./scripts/local-doctor.sh
npm install --no-audit --no-fund
```

The first successful networked install should generate `package-lock.json`. Commit that lockfile immediately, then use `npm ci` locally and in CI. Until then, dependency versions in workspace package files are pinned exactly.

```bash
npm run verify
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:8787

Fixture mode is standalone and should remain usable even when public APIs are unavailable.

## Publish to GitHub and activate CI

With GitHub CLI authenticated:

```bash
./scripts/publish-github.sh OWNER/rekt-ink-terminal --private
```

GitHub Actions in `.github/workflows/ci.yml` will run on pushes and PRs.

After the first install creates a lockfile, update CI from `npm install --no-audit --no-fund` to `npm ci`.

## Agent phase workflow

Read:

- `docs/FRONTEND_AGENT_WORKFLOW_V1.md`
- `docs/agent-packets/PHASE_PACKET_TEMPLATE.md`
- `docs/agent-packets/FRONTEND_BAKEOFF_V1.md`

Every agent handoff binds to the current `git rev-parse HEAD` and uses the same acceptance packet.
