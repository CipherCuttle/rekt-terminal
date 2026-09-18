import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
const origin = 'http://127.0.0.1:5174';

test('authorized repository choices exclude other players, inactive repos and revoked installations', async () => {
  const db = createDatabase(process.env.DATABASE_URL);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin: origin, allowDevAuth: true, sessionTtlSeconds: 3600});
  const session = async () => {
    const response = await app.inject({method:'POST',url:'/v1/dev/session',headers:{origin},payload:{display_name:`Source choices ${randomUUID().slice(0,8)}`}});
    assert.equal(response.statusCode,201);
    return {id:response.json().player.player_id,cookie:response.headers['set-cookie'].split(';')[0]};
  };
  try {
    const owner = await session(); const stranger = await session();
    const base = Math.floor(Math.random()*1000000000)+10000000000;
    for (const [offset, player, revoked] of [[0,owner,false],[10,stranger,false],[20,owner,true]]) {
      const installationId = String(base+offset);
      await db.insertInto('github_installations').values({installation_id:installationId,player_id:player.id,github_user_id:installationId,account_id:installationId,account_type:'User',repository_selection:'selected',revoked_at:revoked?new Date():null}).execute();
      await db.insertInto('github_repositories').values({repository_id:String(base+offset+1),installation_id:installationId,full_name:`private/choices-${offset}`,private:true,active:true}).execute();
      await db.insertInto('github_repositories').values({repository_id:String(base+offset+2),installation_id:installationId,full_name:`private/inactive-${offset}`,private:true,active:false}).execute();
    }
    assert.equal((await app.inject({method:'GET',url:'/v1/github/repositories'})).statusCode,401);
    const response = await app.inject({method:'GET',url:'/v1/github/repositories',headers:{cookie:owner.cookie}});
    assert.equal(response.statusCode,200);
    assert.equal(response.headers['cache-control'],'no-store');
    assert.deepEqual(response.json(),[{repository_id:String(base+1),full_name:'private/choices-0',private:true}]);
  } finally {await app.close();await db.destroy();}
});
