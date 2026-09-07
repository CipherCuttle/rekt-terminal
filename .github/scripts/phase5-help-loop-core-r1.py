from pathlib import Path

p = Path('apps/inkubator-api/src/social.ts')
text = p.read_text()
text = text.replace("import {sql, type Kysely} from 'kysely';", "import {sql, type Kysely, type Selectable} from 'kysely';", 1)
text = text.replace('function beaconView(beacon: HelpBeaconTable) {', 'function beaconView(beacon: Selectable<HelpBeaconTable>) {', 1)
text = text.replace('function assistView(assist: AssistOfferTable) {', 'function assistView(assist: Selectable<AssistOfferTable>) {', 1)
p.write_text(text)

test_path = Path('apps/inkubator-api/test/unit/authorization.test.mjs')
test_text = test_path.read_text()
old = "  assert.deepEqual(Object.keys(toPublicPlayer(row)).sort(), ['display_name', 'player_id', 'schema_version']);\n"
new = "  const publicPlayer = toPublicPlayer(row);\n  assert.deepEqual(Object.keys(publicPlayer).sort(), ['can_help_with', 'display_name', 'player_id', 'schema_version', 'skills_needed']);\n  assert.equal('created_at' in publicPlayer, false);\n  assert.equal('updated_at' in publicPlayer, false);\n"
if old not in test_text:
    raise SystemExit('expected public-player projection assertion not found')
test_path.write_text(test_text.replace(old, new, 1))

print('Phase 5 harness row typing and public projection contract repaired')
