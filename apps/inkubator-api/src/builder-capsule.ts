import {createHash} from 'node:crypto';
import {
  assertFrozenBuildContract,
  type BuildContract,
  type Criterion,
} from '@rekt-ink/protocol/challenge';
import {canonicalizeJson} from './canonical-json.js';
import type {ChallengeSnapshot} from './challenge-store.js';

export interface BuilderCapsuleFile {
  path: string;
  media_type: 'text/markdown' | 'application/json';
  sha256: string;
  content: string;
}

export interface BuilderCapsuleView {
  schema_version: 'builder-capsule.v1';
  challenge_id: string;
  entry_id: string;
  entry_state: string;
  contract_version: string;
  terms_digest: string;
  submission_deadline: string;
  files: BuilderCapsuleFile[];
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function jsonFile(path: string, value: unknown): BuilderCapsuleFile {
  const content = `${canonicalizeJson(value).value}\n`;
  return {path, media_type: 'application/json', sha256: sha256(content), content};
}

function markdownFile(path: string, content: string): BuilderCapsuleFile {
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  return {path, media_type: 'text/markdown', sha256: sha256(normalized), content: normalized};
}

function criteria(value: unknown): Criterion[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const candidate = (value as {criteria?: unknown}).criteria;
  return Array.isArray(candidate) ? candidate.filter((item): item is Criterion => Boolean(
    item
    && typeof item === 'object'
    && typeof (item as Criterion).id === 'string'
    && typeof (item as Criterion).description === 'string'
    && typeof (item as Criterion).mandatory === 'boolean',
  )) : [];
}

function renderCriteria(title: string, items: Criterion[]): string[] {
  const lines = [`## ${title}`, ''];
  if (items.length === 0) return [...lines, '_No criteria declared._', ''];
  return [
    ...lines,
    ...items.map((item) => `- [${item.mandatory ? 'x' : ' '}] **${item.id}** — ${item.description}`),
    '',
  ];
}

function buildChallengeMarkdown(contract: BuildContract & {terms_digest: string}): string {
  const lines = [
    `# ${contract.title}`,
    '',
    '> DERIVED BUILDER VIEW. Canonical authority is `contract.json` and its frozen `terms_digest`.',
    '',
    `**Challenge:** \`${contract.challenge_id}\`  `,
    `**Contract:** \`${contract.contract_version}\`  `,
    `**Terms digest:** \`${contract.terms_digest}\`  `,
    `**Build starts:** ${new Date(contract.build_start).toISOString()}  `,
    `**Submission deadline:** ${new Date(contract.submission_deadline).toISOString()}`,
    '',
    '## Brief',
    '',
    contract.brief,
    '',
    ...renderCriteria('Outcome Contract', criteria(contract.outcome_contract)),
    ...renderCriteria('Production Envelope', criteria(contract.production_envelope)),
    ...renderCriteria('Delivery Contract', criteria(contract.delivery_contract)),
    ...renderCriteria('Normative Constraints', contract.normative_constraints ?? []),
    '## References',
    '',
  ];

  if (contract.normative_references.length === 0 && (contract.informational_references?.length ?? 0) === 0) {
    lines.push('_No references declared._', '');
  } else {
    for (const reference of contract.normative_references) {
      lines.push(`- **NORMATIVE** \`${reference.id}\` — ${reference.kind} — digest \`${reference.content_digest}\`${reference.source_url ? ` — ${reference.source_url}` : ''}`);
    }
    for (const reference of contract.informational_references ?? []) {
      lines.push(`- **INFORMATIONAL** \`${reference.id}\` — ${reference.url}`);
    }
    lines.push('');
  }

  lines.push(
    '## Preferences',
    '',
    'Preferences are non-qualifying selection guidance unless the frozen contract says otherwise.',
    '',
    '```json',
    canonicalizeJson(contract.preferences).value,
    '```',
    '',
    '## Reference Architecture',
    '',
    'Reference architecture is advisory unless a frozen criterion or normative constraint makes a specific interface/technology mandatory.',
    '',
    '```json',
    canonicalizeJson(contract.reference_architecture).value,
    '```',
    '',
  );

  return lines.join('\n');
}

function assertCapsuleContract(snapshot: ChallengeSnapshot): BuildContract & {terms_digest: string} {
  if (!snapshot.contract || !snapshot.challenge.current_terms_digest || !snapshot.challenge.current_contract_version) {
    throw new Error('challenge_contract_not_frozen');
  }
  const contract = assertFrozenBuildContract(snapshot.contract.contract_json) as BuildContract & {terms_digest: string};
  if (
    contract.challenge_id !== snapshot.challenge.challenge_id
    || contract.contract_version !== snapshot.challenge.current_contract_version
    || contract.terms_digest !== snapshot.challenge.current_terms_digest
    || contract.terms_digest !== snapshot.contract.terms_digest
  ) {
    throw new Error('challenge_contract_pointer_invalid');
  }
  return contract;
}

export function buildBuilderCapsule(snapshot: ChallengeSnapshot, playerId: string): BuilderCapsuleView {
  const entry = snapshot.entries.find((candidate) => candidate.builder_player_id === playerId);
  if (!entry) throw new Error('challenge_entry_required');
  const contract = assertCapsuleContract(snapshot);

  const acceptanceManifest = {
    schema_version: 'builder-capsule.acceptance.v1',
    challenge_id: contract.challenge_id,
    terms_digest: contract.terms_digest,
    criteria: [
      ...criteria(contract.outcome_contract).map((item) => ({section: 'OUTCOME', ...item})),
      ...criteria(contract.production_envelope).map((item) => ({section: 'PRODUCTION_ENVELOPE', ...item})),
      ...criteria(contract.delivery_contract).map((item) => ({section: 'DELIVERY', ...item})),
      ...contract.normative_constraints.map((item) => ({section: 'NORMATIVE_CONSTRAINT', ...item})),
    ],
    executable_checks_authorized: false,
  };

  const referencesManifest = {
    schema_version: 'builder-capsule.references.v1',
    challenge_id: contract.challenge_id,
    terms_digest: contract.terms_digest,
    normative: contract.normative_references,
    informational: contract.informational_references ?? [],
  };

  const files = [
    markdownFile('CHALLENGE.md', buildChallengeMarkdown(contract)),
    jsonFile('contract.json', contract),
    jsonFile('acceptance/manifest.json', acceptanceManifest),
    jsonFile('references/manifest.json', referencesManifest),
  ];

  return {
    schema_version: 'builder-capsule.v1',
    challenge_id: contract.challenge_id,
    entry_id: entry.entry_id,
    entry_state: entry.state,
    contract_version: contract.contract_version,
    terms_digest: contract.terms_digest,
    submission_deadline: new Date(contract.submission_deadline).toISOString(),
    files,
  };
}
