from pathlib import Path

p = Path('apps/inkubator-api/src/social.ts')
text = p.read_text()
text = text.replace("import {sql, type Kysely} from 'kysely';", "import {sql, type Kysely, type Selectable} from 'kysely';", 1)
text = text.replace('function beaconView(beacon: HelpBeaconTable) {', 'function beaconView(beacon: Selectable<HelpBeaconTable>) {', 1)
text = text.replace('function assistView(assist: AssistOfferTable) {', 'function assistView(assist: Selectable<AssistOfferTable>) {', 1)
p.write_text(text)
print('Phase 5 harness row typing repaired')
