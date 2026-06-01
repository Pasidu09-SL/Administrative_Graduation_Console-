import { pool, runMigrations } from '../lib/db';

async function testConnection() {
  console.log('Testing connection to PostgreSQL...');
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('PostgreSQL Connection Successful! Server time:', res.rows[0].now);
    
    await runMigrations();
    console.log('Migration verification step complete.');
    process.exit(0);
  } catch (err) {
    console.error('PostgreSQL Connection failed:', err);
    process.exit(1);
  }
}

testConnection();
