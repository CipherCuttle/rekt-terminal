import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page, type Route} from '@playwright/test';
import type {AcceptedShipArtifactView, CommandView, ProjectShipStateView, ShipSubmissionPrivateView} from '../src/generated/inkubator-api-client';

const readyCommand: CommandView = {
  schema_version: 'command.private.v2',
  project: {project_id: 'PROJECT-E2E', name: 'REKT MACHINE', source_connected: true, source_visibility: 'PUBLIC', observation_state: 'OBSERVED'},
  mission: {
    mission_id: 'MISSION-E2E', state: 'SHIP_READY', goal: 'Ship a working strange thing.',
    ship_condition: 'Public HTTPS artifact that survives external verification.', current_focus: 'Submit the bounded artifact.', next_move: 'Submit the artifact for verification.',
    progress_model_version: 'mission.progress.v1', stack_labels: ['JAVASCRIPT_TYPESCRIPT'], stack_source: 'PLAYER_CONFIRMED',
  },
  gates: [
    {key: 'FOUNDATION', label: 'Foundation', state: 'PROVEN', position: 1},
    {key: 'CORE_EXPERIENCE', label: 'Core experience', state: 'PROVEN', position: 2},
    {key: 'QUALITY_TESTING', label: 'Quality testing', state: 'OBSERVED', position: 3},
    {key: 'SHIPABILITY', label: 'Shipability', state: 'CLAIMED', position: 4},
  ],
  github_evidence: {rule_version: 'github-evidence.v1', source_state: 'AVAILABLE', signal_state: 'OBSERVED', stale_after_ms: 300000, invalid_observation_count: 0, reason_code: 'latest_observation_current', observed_stacks: ['JAVASCRIPT_TYPESCRIPT']},
  daemon: {rule_version: 'daemon-advisory.v1', authority: 'ADVISORY_ONLY', what_changed: 'Mission is ready.', proposed_next_move: 'Submit the artifact.'},
};

const emptyShip: ProjectShipStateView = {schema_version: 'project.ship.public.v2', project_id: 'PROJECT-E2E'};

const acceptedArtifact: AcceptedShipArtifactView = {
  schema_version: 'ship.artifact.public.v1', receipt_id: 'RECEIPT-E2E', receipt_schema_version: 'inkubator.ship-receipt/1.0', submission_id: 'SUBMISSION-E2E',
  mission_id: 'MISSION-E2E', project_id: 'PROJECT-E2E', owner_player_id: 'PLAYER-OWNER', acceptance_rule_version: 'ship.acceptance.v1',
  artifact: {title: 'REKT MACHINE', url: 'https://example.com/rekt', demo_url: 'https://example.com/demo'},
  builders: [{player_id: 'PLAYER-OWNER', display_name: 'CipherCuttle', role: 'OWNER'}, {player_id: 'PLAYER-PARTY', display_name: 'Helper', role: 'PARTY'}],
  assists: [{assist_id: 'ASSIST-E2E', player_id: 'PLAYER-TESTER', display_name: 'Tester', accepted_at: '2026-09-10T09:00:00Z', source_state: 'ACCEPTED'}],
  evidence: {verifier_observation_id: 'OBS-E2E', acceptance_review_id: 'REVIEW-E2E'}, truth_state: 'PROVEN', shipped_at: '2026-09-10T09:03:00Z',
};

const provenShip: ProjectShipStateView = {
  schema_version: 'project.ship.public.v2', project_id: 'PROJECT-E2E', latest_submission: {
    schema_version: 'ship.submission.public.v2', submission_id: 'SUBMISSION-E2E', mission_id: 'MISSION-E2E', project_id: 'PROJECT-E2E',
    artifact: {title: 'REKT MACHINE', url: 'https://example.com/rekt', demo_url: 'https://example.com/demo'}, state: 'PROVEN', submitted_at: '2026-09-10T09:01:00Z',
    verifier_observation: {schema_version: 'ship.verifier_observation.public.v1', outcome: 'PASS', reason_code: 'artifact_reachable', http_status: 200, duration_ms: 120, redirects: 0, observed_at: '2026-09-10T09:01:02Z'},
    accepted_ship: acceptedArtifact,
  },
};

const observedShip: ProjectShipStateView = {
  schema_version: 'project.ship.public.v2', project_id: 'PROJECT-E2E', latest_submission: {
    schema_version: 'ship.submission.public.v2', submission_id: 'SUBMISSION-E2E', mission_id: 'MISSION-E2E', project_id: 'PROJECT-E2E',
    artifact: {title: 'REKT MACHINE', url: 'https://example.com/rekt'}, state: 'OBSERVED', submitted_at: '2026-09-10T09:01:00Z',
    verifier_observation: {schema_version: 'ship.verifier_observation.public.v1', outcome: 'PASS', reason_code: 'artifact_reachable', http_status: 200, duration_ms: 120, redirects: 0, observed_at: '2026-09-10T09:01:02Z'},
  },
};

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test('LIVE SHIP records a SHIP_READY owner submission then renders only server-projected SUBMITTED state', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  let command = readyCommand;
  let shipState = emptyShip;
  let submittedBody: Record<string, unknown> | undefined;

  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/v1/me/command' && request.method() === 'GET') return fulfillJson(route, 200, command);
    if (pathname === '/v1/projects/PROJECT-E2E/ship' && request.method() === 'GET') return fulfillJson(route, 200, shipState);
    if (pathname === '/v1/missions/MISSION-E2E/ship-submissions' && request.method() === 'POST') {
      submittedBody = request.postDataJSON() as Record<string, unknown>;
      const submittedAt = '2026-09-10T09:10:00Z';
      const privateSubmission: ShipSubmissionPrivateView = {
        schema_version: 'ship.submission.private.v1', submission_id: 'SUBMISSION-NEW', mission_id: 'MISSION-E2E', project_id: 'PROJECT-E2E',
        artifact: {title: String(submittedBody.title), url: String(submittedBody.url)}, state: 'SUBMITTED', submitted_at: submittedAt,
      };
      command = {...readyCommand, mission: {...readyCommand.mission, state: 'SUBMITTED', next_move: 'Wait for verifier observation.'}};
      shipState = {schema_version: 'project.ship.public.v2', project_id: 'PROJECT-E2E', latest_submission: {
        schema_version: 'ship.submission.public.v2', submission_id: 'SUBMISSION-NEW', mission_id: 'MISSION-E2E', project_id: 'PROJECT-E2E',
        artifact: {title: String(submittedBody.title), url: String(submittedBody.url)}, state: 'SUBMITTED', submitted_at: submittedAt,
      }};
      return fulfillJson(route, 201, privateSubmission);
    }
    return route.continue();
  });

  await page.goto('/?mode=ship');
  await expect(page.getByRole('heading', {name: 'Ship the thing.'})).toBeVisible();
  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-shell-variant', 'v2');
  await expect(page.getByText('NO SUBMISSION RECORDED')).toBeVisible();

  await page.getByLabel('PUBLIC ARTIFACT URL').fill('https://example.com/rekt');
  await expect(page.getByRole('button', {name: 'SUBMIT FOR VERIFICATION'})).toBeEnabled();
  await page.getByRole('button', {name: 'SUBMIT FOR VERIFICATION'}).click();

  await expect(page.getByText('SUBMISSION-NEW').first()).toBeVisible();
  await expect(page.getByText('SUBMITTED', {exact: true}).first()).toBeVisible();
  await expect(page.getByText('NO ACCEPTED SHIP RECEIPT YET')).toBeVisible();
  expect(submittedBody?.title).toBe('REKT MACHINE');
  expect(submittedBody?.url).toBe('https://example.com/rekt');
  expect(String(submittedBody?.request_id)).toMatch(/^[0-9a-f-]{36}$/i);

  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('LIVE SHIP keeps verifier PASS at OBSERVED without minting a receipt', async ({page}) => {
  await page.route('**/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/v1/me/command') return fulfillJson(route, 200, {...readyCommand, mission: {...readyCommand.mission, state: 'SUBMITTED'}});
    if (pathname === '/v1/projects/PROJECT-E2E/ship') return fulfillJson(route, 200, observedShip);
    return route.continue();
  });

  await page.goto('/?mode=ship');
  await expect(page.getByText('artifact_reachable')).toBeVisible();
  await expect(page.getByText('NO ACCEPTED SHIP RECEIPT YET')).toBeVisible();
  await expect(page.getByText(/Observation alone is not proof/i)).toBeVisible();
  await expect(page.locator('.ship-receipt')).toHaveCount(0);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('LIVE SHIP renders the immutable PROVEN receipt as the dominant mobile artifact', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('**/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/v1/me/command') return fulfillJson(route, 200, {...readyCommand, mission: {...readyCommand.mission, state: 'SHIPPED'}});
    if (pathname === '/v1/projects/PROJECT-E2E/ship') return fulfillJson(route, 200, provenShip);
    return route.continue();
  });

  await page.goto('/?mode=ship');
  await expect(page.locator('.ship-artifact-stage')).toContainText('REKT MACHINE');
  await expect(page.getByText('RECEIPT-E2E')).toBeVisible();
  await expect(page.getByText('OBS-E2E')).toBeVisible();
  await expect(page.getByText('REVIEW-E2E')).toBeVisible();
  await expect(page.getByText('CipherCuttle').first()).toBeVisible();
  await expect(page.getByText('Helper')).toBeVisible();
  await expect(page.getByText('Tester')).toBeVisible();
  await expect(page.locator('[data-truth="proven"]')).not.toHaveCount(0);

  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('LIVE SHIP fails closed on unknown Ship state and on missing private command authority', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.route('**/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/v1/me/command') return fulfillJson(route, 200, readyCommand);
    if (pathname === '/v1/projects/PROJECT-E2E/ship') return fulfillJson(route, 503, {error: 'ship_state_offline'});
    return route.continue();
  });
  await page.goto('/?mode=ship');
  await expect(page.getByText('SHIP STATE UNAVAILABLE — SUBMISSION DISABLED')).toBeVisible();
  await page.getByLabel('PUBLIC ARTIFACT URL').fill('https://example.com/rekt');
  await expect(page.getByRole('button', {name: 'SUBMIT FOR VERIFICATION'})).toBeDisabled();
  await expectNoHorizontalOverflow(page);

  await page.unroute('**/v1/**');
  await page.route('**/v1/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/v1/me/command') return fulfillJson(route, 401, {error: 'authentication_required'});
    return route.continue();
  });
  await page.goto('/?mode=ship');
  await expect(page.getByRole('heading', {name: 'SHIP LINK UNAVAILABLE'})).toBeVisible();
  await expect(page.getByText('authentication_required')).toBeVisible();
  await expect(page.getByText(/No development fixture fallback is permitted/i)).toBeVisible();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});