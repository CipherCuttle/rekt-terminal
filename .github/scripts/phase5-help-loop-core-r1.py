from pathlib import Path

p = Path('apps/inkubator-api/src/social.ts')
text = p.read_text()
text = text.replace("import {sql, type Kysely} from 'kysely';", "import {sql, type Kysely, type Selectable} from 'kysely';", 1)
text = text.replace('function beaconView(beacon: HelpBeaconTable) {', 'function beaconView(beacon: Selectable<HelpBeaconTable>) {', 1)
text = text.replace('function assistView(assist: AssistOfferTable) {', 'function assistView(assist: Selectable<AssistOfferTable>) {', 1)
p.write_text(text)

def patch_public_projection_assertion(path: str) -> None:
    test_path = Path(path)
    test_text = test_path.read_text()
    old = "  assert.deepEqual(Object.keys(toPublicPlayer(row)).sort(), ['display_name', 'player_id', 'schema_version']);\n" if path.endswith('authorization.test.mjs') else "    assert.deepEqual(Object.keys(publicView.json()).sort(), ['display_name', 'player_id', 'schema_version']);\n"
    if path.endswith('authorization.test.mjs'):
        new = "  const publicPlayer = toPublicPlayer(row);\n  assert.deepEqual(Object.keys(publicPlayer).sort(), ['can_help_with', 'display_name', 'player_id', 'schema_version', 'skills_needed']);\n  assert.equal('created_at' in publicPlayer, false);\n  assert.equal('updated_at' in publicPlayer, false);\n"
    else:
        new = "    const publicBody = publicView.json();\n    assert.deepEqual(Object.keys(publicBody).sort(), ['can_help_with', 'display_name', 'player_id', 'schema_version', 'skills_needed']);\n    assert.equal(publicBody.schema_version, 'player.public.v2');\n    assert.deepEqual(publicBody.skills_needed, []);\n    assert.deepEqual(publicBody.can_help_with, []);\n    assert.equal('created_at' in publicBody, false);\n    assert.equal('updated_at' in publicBody, false);\n"
    if old not in test_text:
        raise SystemExit(f'expected public-player projection assertion not found in {path}')
    test_path.write_text(test_text.replace(old, new, 1))

patch_public_projection_assertion('apps/inkubator-api/test/unit/authorization.test.mjs')
patch_public_projection_assertion('apps/inkubator-api/test/integration/session.test.mjs')

print('Phase 5 row typing + public projection unit/integration regressions repaired')
