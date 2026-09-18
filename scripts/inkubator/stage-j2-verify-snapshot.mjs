import fs from 'node:fs';
import {
  assertStageJ2VaultSnapshotMatchesPlan,
} from '../../packages/inkubator-protocol/src/testnet-vault-adapter.mjs';

const [fixturePath, snapshotPath] = process.argv.slice(2);
if (!fixturePath || !snapshotPath) {
  throw new Error('usage: node stage-j2-verify-snapshot.mjs <fixture.json> <snapshot.json>');
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
assertStageJ2VaultSnapshotMatchesPlan(fixture.vault_plan, snapshot);

process.stdout.write(JSON.stringify({
  verdict: 'PASS',
  vault_address: snapshot.vault_address,
  plan_digest: snapshot.plan_digest,
  chain_id: snapshot.chain_id,
}, null, 2));
