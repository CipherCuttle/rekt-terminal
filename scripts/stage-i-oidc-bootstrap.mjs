import {createPublicKey, verify as verifySignature} from 'node:crypto';

const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const OIDC_AUDIENCE = 'rekt-stage-i-rehearsal';
const ALLOWED_REPOSITORY = 'CipherCuttle/rekt-terminal';
const ALLOWED_REF = 'refs/heads/rehearsal/stage-i-remote-multibuilder-v1';

function parseJsonSegment(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

function audienceMatches(value) {
  return Array.isArray(value) ? value.includes(OIDC_AUDIENCE) : value === OIDC_AUDIENCE;
}

async function verifyGitHubActionsOidc(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('oidc_token_malformed');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonSegment(encodedHeader);
  const claims = parseJsonSegment(encodedPayload);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('oidc_header_invalid');

  const metadataResponse = await fetch(`${OIDC_ISSUER}/.well-known/openid-configuration`);
  if (!metadataResponse.ok) throw new Error('oidc_metadata_unavailable');
  const metadata = await metadataResponse.json();
  if (metadata.issuer !== OIDC_ISSUER || typeof metadata.jwks_uri !== 'string') throw new Error('oidc_metadata_invalid');

  const jwksResponse = await fetch(metadata.jwks_uri);
  if (!jwksResponse.ok) throw new Error('oidc_jwks_unavailable');
  const jwks = await jwksResponse.json();
  const jwk = Array.isArray(jwks.keys) ? jwks.keys.find((candidate) => candidate.kid === header.kid) : null;
  if (!jwk) throw new Error('oidc_signing_key_missing');

  const key = createPublicKey({key: jwk, format: 'jwk'});
  const verified = verifySignature(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8'),
    key,
    Buffer.from(encodedSignature, 'base64url'),
  );
  if (!verified) throw new Error('oidc_signature_invalid');

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== OIDC_ISSUER) throw new Error('oidc_issuer_invalid');
  if (!audienceMatches(claims.aud)) throw new Error('oidc_audience_invalid');
  if (!Number.isInteger(claims.exp) || claims.exp <= now) throw new Error('oidc_expired');
  if (Number.isInteger(claims.nbf) && claims.nbf > now + 30) throw new Error('oidc_not_yet_valid');
  if (claims.repository !== ALLOWED_REPOSITORY) throw new Error('oidc_repository_invalid');
  if (claims.ref !== ALLOWED_REF) throw new Error('oidc_ref_invalid');
  if (claims.event_name !== 'push') throw new Error('oidc_event_invalid');
  return claims;
}

let consumed = false;
let inFlight = false;

export async function handleStageIRehearsalBootstrap(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, {'content-type': 'application/json'});
    res.end(JSON.stringify({error: 'method_not_allowed'}));
    return;
  }
  if (consumed || inFlight) {
    res.writeHead(410, {'content-type': 'application/json', 'cache-control': 'no-store'});
    res.end(JSON.stringify({error: 'bootstrap_consumed'}));
    return;
  }

  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    res.writeHead(401, {'content-type': 'application/json', 'cache-control': 'no-store'});
    res.end(JSON.stringify({error: 'oidc_required'}));
    return;
  }

  inFlight = true;
  try {
    await verifyGitHubActionsOidc(authorization.slice('Bearer '.length));
    const [{createDatabase}, {createPlayer}, {createSession}] = await Promise.all([
      import('../apps/inkubator-api/dist/database.js'),
      import('../apps/inkubator-api/dist/players.js'),
      import('../apps/inkubator-api/dist/session.js'),
    ]);
    if (!process.env.DATABASE_URL) throw new Error('database_url_missing');
    const db = createDatabase(process.env.DATABASE_URL);
    try {
      const identities = [];
      for (const label of ['Stage I Remote Organizer', 'Stage I Remote Builder A', 'Stage I Remote Builder B', 'Stage I Remote Builder C']) {
        const player = await createPlayer(db, `${label} ${Date.now().toString(36)}`);
        const session = await createSession(db, player.player_id, 3600);
        identities.push({player_id: player.player_id, display_name: player.display_name, session_token: session.token});
      }
      consumed = true;
      res.writeHead(201, {'content-type': 'application/json', 'cache-control': 'no-store'});
      res.end(JSON.stringify({schema_version: 'stage-i.rehearsal-bootstrap/1.0', identities}));
    } finally {
      await db.destroy();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'bootstrap_failed';
    res.writeHead(403, {'content-type': 'application/json', 'cache-control': 'no-store'});
    res.end(JSON.stringify({error: message}));
  } finally {
    inFlight = false;
  }
}
