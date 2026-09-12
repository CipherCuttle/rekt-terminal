// Real local API + Postgres browser journey. OAuth provider and installation verification
// are external boundaries: development identity + a verified-installation test input
// are explicit test setup, never a production fixture fallback.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {buildApp} from '../../apps/inkubator-api/dist/app.js';
import {createDatabase} from '../../apps/inkubator-api/dist/database.js';
import {migrateToLatest} from '../../apps/inkubator-api/dist/migrations.js';
import {finalizeGitHubSetup, processGitHubWebhook} from '../../apps/inkubator-api/dist/github.js';
import {runOneJob} from '../../apps/inkubator-api/dist/jobs.js';
import {operatorReviewShipAcceptance} from '../../apps/inkubator-api/dist/ship-acceptance.js';
import {verifyPublicUrl} from '../../apps/inkubator-verifier/dist/policy.js';

const origin = 'http://127.0.0.1:5184';
const db = createDatabase(process.env.DATABASE_URL);
await migrateToLatest(db);
const app = buildApp({db, appOrigin: origin, allowDevAuth: true, sessionTtlSeconds: 3600});
await app.listen({host:'127.0.0.1',port:8788});
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1440,height:900}});
const page = await context.newPage();
const evidence = 'artifacts/product-coherence';
await mkdir(evidence,{recursive:true});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const checks = [];
async function shot(name) {console.log('EVIDENCE',name);await page.screenshot({path:`${evidence}/${name}.png`,fullPage:true});}
async function inspect(name) {
  await expect(page.locator('[data-shell="terminal"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all(document.getAnimations({subtree:true}).map(a => a.finished.catch(() => {}))));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),`${name}: overflow`);
  const violations = (await new AxeBuilder({page}).analyze()).violations;
  await writeFile(`${evidence}/${name}-axe.json`,JSON.stringify(violations,null,2));
  await shot(name);
  assert.deepEqual(violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})),[],`${name}: accessibility`);
  checks.push(name);
}
try {
  await page.goto(origin);
  await expect(page.getByRole('link',{name:'CONTINUE WITH GITHUB →'})).toBeVisible();
  await shot('auth');
  const session = await page.request.post(`${origin}/v1/dev/session`, {headers:{origin},data:{display_name:`Coherence ${randomUUID().slice(0,6)}`}});
  assert.equal(session.status(),201);
  const player = (await session.json()).player;
  await page.reload();
  await expect(page.getByRole('heading',{name:'Declare your Mission'})).toBeVisible();
  await page.getByLabel('Project name').fill('Coherence workbench');
  await page.getByLabel('What are you building?').fill('Make a useful public artifact.');
  await page.getByLabel('What must be true to Ship?').fill('A public HTTPS artifact with an accepted review.');
  await page.getByLabel('Current focus').fill('Wire the complete journey.');
  await page.getByLabel('Your next move').fill('Connect the repository.');
  await page.getByRole('button',{name:'DECLARE MISSION',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Connect the repository.'})).toBeVisible();
  const command = await page.evaluate(async () => (await fetch('/v1/me/command')).json());
  const projectId = command.project.project_id, missionId = command.mission.mission_id;
  const installationId=String(Date.now()), repositoryId=String(Date.now()+1);
  await finalizeGitHubSetup(db,player.player_id,new Date(),{installationId,githubUserId:installationId,accountId:installationId,accountType:'User',repositorySelection:'selected',repositories:[{repositoryId,fullName:'coherence/private-source',private:true}]});
  await page.getByText('SOURCE / REPOSITORY ACCESS',{exact:true}).click();
  await page.getByRole('button',{name:'REFRESH REPOSITORIES'}).click();
  await expect(page.getByRole('option',{name:'coherence/private-source / PRIVATE'})).toHaveCount(1);
  await page.getByLabel('Authorized repository',{exact:true}).selectOption(repositoryId);
  await page.getByRole('button',{name:'LINK AUTHORIZED REPOSITORY'}).click();
  await expect(page.getByText(/SOURCE CONNECTED \/ PRIVATE/)).toBeVisible();
  await processGitHubWebhook(db,{deliveryId:randomUUID(),eventName:'push',rawBody:Buffer.from(JSON.stringify({installation:{id:Number(installationId)},repository:{id:Number(repositoryId),full_name:'coherence/private-source',private:true},ref:'refs/heads/main',before:'a'.repeat(40),after:'b'.repeat(40),deleted:false,commits:[]}))});
  await page.getByText('EDIT WORK / DECLARED STATE',{exact:true}).click();
  await page.getByLabel('Work state',{exact:true}).selectOption('BUILDING');
  await page.getByLabel('Next move',{exact:true}).fill('Test the artifact.');
  await page.getByRole('button',{name:'SAVE WORK STATE'}).click();
  await expect(page.getByRole('heading',{name:'Test the artifact.'})).toBeVisible();
  await page.getByText('HELP / ASK FOR A CONTRIBUTION',{exact:true}).click();
  await page.getByLabel('What help would move this build forward?').fill('Review the mobile journey.');
  await page.getByRole('button',{name:'OPEN HELP BEACON'}).click();
  await expect(page.getByRole('button',{name:'OPEN HELP BEACON'})).toBeEnabled();
  await page.getByText('EXTERNAL TEST / ASK FOR EVIDENCE',{exact:true}).click();
  await page.getByLabel('What should another builder test?').fill('Check the public artifact navigation.');
  await page.getByRole('button',{name:'REQUEST EXTERNAL TEST'}).click();
  await expect(page.getByRole('button',{name:'REQUEST EXTERNAL TEST'})).toBeEnabled();
  // Real projections at both required viewports; collapsed controls preserve hierarchy.
  await page.goto(origin);
  await expect(page.getByRole('heading',{name:'Test the artifact.'})).toBeVisible();
  for (const [width,height,label] of [[1440,900,'desktop'],[390,844,'mobile']]) {
    await page.setViewportSize({width,height});
    for (const mode of ['command','project','player','world']) {
      await page.goto(`${origin}/?mode=${mode}`);
      await expect(page.locator(`.${mode}-live`)).toBeVisible();
      if(mode==='project') {await expect(page.getByRole('button',{name:/GitHub source/})).toBeVisible();await page.getByRole('button',{name:/GitHub source/}).press('ArrowDown');await expect(page.getByRole('complementary')).toContainText('External tests');}
      await inspect(`${mode}-${label}`);
    }
  }
  await page.goto(origin);
  await page.getByText('EDIT WORK / DECLARED STATE',{exact:true}).click();
  await page.getByLabel('Work state',{exact:true}).selectOption('SHIP_READY');
  await page.getByRole('button',{name:'SAVE WORK STATE'}).click();
  await page.getByRole('link',{name:'OPEN SHIP →'}).click();
  await expect(page.getByText('NO SUBMISSION RECORDED')).toBeVisible();
  await page.getByLabel('PUBLIC ARTIFACT URL').fill('https://example.com/');
  await page.getByRole('button',{name:'SUBMIT FOR VERIFICATION'}).click();
  await expect(page.getByRole('button',{name:/01 SUBMITTED/})).toBeVisible();
  await shot('ship-submitted-mobile');
  const submission=(await (await page.request.get(`${origin}/v1/projects/${projectId}/ship`)).json()).latest_submission;
  // Use the actual bounded HTTPS verifier. No forged PASS.
  const verifierResult = await verifyPublicUrl(submission.submission_id, submission.artifact.url);
  assert.equal(verifierResult.outcome,'PASS',`external verifier: ${verifierResult.reason_code}`);
  const shipVerifierClient={verify:async ({submissionId})=>({schema_version:'ship-verifier.observation.v1',submission_id:submissionId,...verifierResult})};
  // Earlier journey actions enqueue their own jobs; drain until idle so the ship
  // verification job is actually claimed and applied.
  for(let drained=0;drained<25;drained++){if((await runOneJob(db,{shipVerifierClient})).status==='idle')break;}
  await expect(page.getByRole('button',{name:/02 OBSERVED PASS/})).toBeEnabled({timeout:15000});
  await page.getByRole('button',{name:/02 OBSERVED PASS/}).click();
  await expect(page.getByRole('complementary',{name:'Selected Ship record'})).toContainText('Verifier observation.');
  await expect(page.locator('.ship-proof-mark')).toHaveCount(0);
  await inspect('ship-observed-mobile');
  const acceptance=await operatorReviewShipAcceptance(db,submission.submission_id,{requestId:randomUUID(),decision:'ACCEPT',reason:'Local test artifact satisfies the declared HTTPS condition; test operator review.'});
  assert.ok(acceptance.accepted_receipt);
  await expect(page.getByRole('button',{name:/04 PROVEN/})).toBeEnabled({timeout:15000});
  await page.getByRole('button',{name:/04 PROVEN/}).click();
  await expect(page.getByRole('heading',{name:'Accepted receipt'})).toBeVisible();
  assert.equal(await page.evaluate(async () => (await fetch('/v1/me/command')).status),404);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Accepted receipt'})).toBeVisible();
  await page.getByRole('button',{name:/04 PROVEN/}).press('ArrowLeft');
  await expect(page.getByRole('complementary',{name:'Selected Ship record'})).toContainText('Acceptance recorded.');
  await page.getByRole('button',{name:/03 ACCEPTED/}).press('End');
  await inspect('ship-proven-mobile');
  await page.setViewportSize({width:1440,height:900});
  await inspect('ship-proven-desktop');
  await page.goto(`${origin}/?mode=player`);
  await page.getByRole('button',{name:/Ship accepted/}).click();
  await page.getByRole('link',{name:'Open receipt ↗'}).click();
  await expect(page.getByRole('heading',{name:'Accepted receipt'})).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`receipt=${acceptance.accepted_receipt.receipt_id}`));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:/03 ACCEPTED/}).click();
  assert.equal(await page.locator('[data-motion-contract]').getAttribute('data-frame'),'4');
  await shot('historical-receipt-reduced-motion');
  assert.deepEqual(errors,[]);
  checks.push('post-acceptance reload','PLAYER exact receipt reopen','keyboard stages','reduced motion','real HTTPS verifier','no browser runtime errors');
  await writeFile(`${evidence}/journey.json`,JSON.stringify({checks,externalBoundaries:['OAuth uses dev identity in this test','GitHub installation uses verified test input; webhook normalization is real','Acceptance uses trusted local operator function'],projectId,missionId,receiptId:acceptance.accepted_receipt.receipt_id},null,2));
  console.log(JSON.stringify({result:'PASS',checks}));
} catch (error) {await shot('failure');console.error(await page.locator('body').innerText());throw error;} finally {await browser.close();await app.close();await db.destroy();}
