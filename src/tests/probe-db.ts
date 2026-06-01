import { Pool } from 'pg';

const URIS = [
  'postgresql://postgres@localhost:5432/postgres',
  'postgresql://postgres:password@localhost:5432/postgres',
  'postgresql://postgres:root@localhost:5432/postgres',
  'postgresql://postgres:admin@localhost:5432/postgres',
  'postgresql://postgres:1234@localhost:5432/postgres',
  'postgresql://postgres:123456@localhost:5432/postgres',
];

async function probe() {
  for (const uri of URIS) {
    console.log(`Trying connection string: ${uri}`);
    const pool = new Pool({ connectionString: uri, connectionTimeoutMillis: 1000 });
    try {
      const client = await pool.connect();
      console.log(`SUCCESS WITH: ${uri}`);
      const res = await client.query('SELECT NOW()');
      console.log('Time:', res.rows[0].now);
      client.release();
      await pool.end();
      process.exit(0);
    } catch (err: any) {
      console.log(`FAILED: ${err.message}`);
      await pool.end();
    }
  }
  console.log('All connection attempts failed.');
  process.exit(1);
}

probe();
