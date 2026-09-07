from pathlib import Path
p=Path('.github/scripts/phase6a-ship-verifier.py')
s=p.read_text()
old="const job=await db.selectFrom('outbox_jobs').selectAll().where('job_type','=',SHIP_VERIFICATION_JOB_TYPE).where('payload','->>','submission_id','=',submissionId).executeTakeFirst();assert.ok(job);assert.equal(job.state,'pending');"
new="const shipJobs=await db.selectFrom('outbox_jobs').selectAll().where('job_type','=',SHIP_VERIFICATION_JOB_TYPE).execute();const job=shipJobs.find(row=>row.payload&&typeof row.payload==='object'&&!Array.isArray(row.payload)&&row.payload.submission_id===submissionId);assert.ok(job);assert.equal(job.state,'pending');"
if old not in s: raise SystemExit('focused test query marker not found')
p.write_text(s.replace(old,new,1))
