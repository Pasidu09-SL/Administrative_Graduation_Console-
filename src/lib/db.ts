import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';

// Load .env.local programmatically if DATABASE_URL is not set (e.g. when executing standalone scripts)
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...parts] = trimmed.split('=');
          const val = parts.join('=').replace(/^['"]|['"]$/g, '');
          process.env[key.trim()] = val.trim();
        }
      }
    }
  } catch (err) {
    console.error('Failed to load .env.local file programmatically:', err);
  }
}

// PostgreSQL connection config
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Self-healing migrations runner. Runs schema generation if 'students' table is missing.
 */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'students'
      );
    `);
    
    const exists = res.rows[0].exists;
    if (!exists) {
      console.log('Database tables do not exist. Running migrations...');
      // Read migrations.sql file path
      const sqlPath = path.join(process.cwd(), 'src/db/migrations.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
      console.log('Migrations completed successfully.');
    } else {
      console.log('Database tables already exist. Checking schema patches...');
      // Self-healing schema updates for existing databases
      await client.query(`
        ALTER TABLE registration_windows 
        ADD COLUMN IF NOT EXISTS is_manually_closed BOOLEAN DEFAULT FALSE;
      `);
    }
  } catch (err) {
    console.error('Error running migrations:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute db queries under Row Level Security context for a specific student.
 */
export async function runAsStudent<T>(email: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_admin', 'false', true)");
    await client.query("SELECT set_config('app.current_student_email', $1, true)", [email]);
    await client.query("SET LOCAL ROLE app_user");
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute db queries under admin context (which bypasses student RLS filtering).
 */
export async function runAsAdmin<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_admin', 'true', true)");
    await client.query("SELECT set_config('app.current_student_email', '', true)");
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
