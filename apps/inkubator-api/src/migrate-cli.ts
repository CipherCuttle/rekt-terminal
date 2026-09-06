import {createDatabase} from './database.js';
import {migrateToLatest} from './migrations.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const db = createDatabase(databaseUrl);
try {
  await migrateToLatest(db);
  console.log('Inkubator database migrations: PASS');
} finally {
  await db.destroy();
}
