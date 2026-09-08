# REKT INK(CUBATOR) DevKit Quickstart v0

The DevKit is another control surface over the same canonical Inkubator Player/Project/Mission state. It does not own proof, reputation, Cheevos or Ship approval.

## Credential

Create a scoped credential from an authenticated same-origin web session through `POST /v1/devkit/tokens`. The raw token is returned once. Store it in your host secret store or shell environment, not in `.rekt/`:

```bash
export REKT_API_URL=https://inkubator.example
export REKT_DEVKIT_TOKEN='rekt_dk_...'
```

Recommended CLI scopes: `player:read project:read mission:read claim:write update:write beacon:write assist:write ship:prepare`.

## CLI

```bash
npx @rekt-ink/cli init
rekt status
rekt next
rekt update --focus "Verifier polish" --next "Run hostile tests"
rekt claim QUALITY_TESTING
rekt beacon --summary "Need a mobile pass" --skills "mobile,ux"
rekt ship --title "Demo" --url "https://example.com/demo"
rekt doctor
```

`rekt ship` creates a claimed submission for the existing verifier/acceptance path. It cannot approve the Ship.

## SDK

Browser code uses the cookie-authenticated root entry. It has no bearer-token option and therefore preserves the web origin/CSRF boundary:

```ts
import {createInkubatorClient} from '@rekt-ink/sdk';
const ink = createInkubatorClient({baseUrl: 'https://inkubator.example'});
const state = await ink.mission.current();
await ink.mission.update({currentFocus: 'Ship the integration'});
```

Server, CLI and agent processes use the deliberate server-only credential entry:

```ts
import {createInkubatorServerClientFromEnv} from '@rekt-ink/sdk/server';
const ink = createInkubatorServerClientFromEnv();
const state = await ink.mission.current();
```

Never bundle `REKT_DEVKIT_TOKEN` or `@rekt-ink/sdk/server` into browser code.

## MCP

```json
{
  "mcpServers": {
    "rekt-inkubator": {
      "command": "npx",
      "args": ["@rekt-ink/mcp"],
      "env": {
        "REKT_API_URL": "https://inkubator.example",
        "REKT_DEVKIT_TOKEN": "..."
      }
    }
  }
}
```

MCP v0 exposes only Player-level read/claim/update/help/assist/ship-preparation resources/tools. No proof/operator/verifier tools exist.
