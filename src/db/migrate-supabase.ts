import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function main() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local file not found!');
    process.exit(1);
  }

  // Load the current connection string
  const envContent = fs.readFileSync(envPath, 'utf8');
  let supabaseDbUrl = '';
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('DATABASE_URL')) {
      const parts = trimmed.split('=');
      supabaseDbUrl = parts.slice(1).join('=').replace(/^['"]|['"]$/g, '').trim();
    }
  }

  if (!supabaseDbUrl) {
    console.error('DATABASE_URL not found in .env.local!');
    process.exit(1);
  }

  console.log('Connecting directly to Supabase PostgreSQL database...');
  const client = new Client({
    connectionString: supabaseDbUrl,
    ssl: { rejectUnauthorized: false } // Required for cloud databases like Supabase
  });

  try {
    await client.connect();
    console.log('Connected successfully!');

    console.log('Reading migrations.sql schema file...');
    const sqlPath = path.join(process.cwd(), 'src', 'db', 'migrations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migrations on Supabase (dropping old public tables and rebuilding schema)...');
    await client.query(sql);
    console.log('✓ Success: Migrations executed successfully on Supabase cloud database!');
  } catch (err: any) {
    console.error('❌ Error executing migrations on Supabase:', err.stack || err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
