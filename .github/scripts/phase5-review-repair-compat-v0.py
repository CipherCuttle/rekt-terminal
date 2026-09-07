from pathlib import Path

path = Path('apps/inkubator-api/test/integration/phase5-project-discussion-world.test.mjs')
text = path.read_text()
old = "assert.equal(world.json().every((s)=>['HELP_BEACON_OPENED','ASSIST_ACCEPTED'].includes(s.kind)),true);"
new = "assert.equal(mine.every((s)=>['HELP_BEACON_OPENED','ASSIST_ACCEPTED'].includes(s.kind)),true);"
if old not in text:
    raise SystemExit('missing Phase 5B1 World assertion anchor')
path.write_text(text.replace(old, new, 1))
print('Phase 5B1 World regression scoped to its own Project')
