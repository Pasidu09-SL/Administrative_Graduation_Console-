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

// Auto-run migrations on startup to apply schema patches/migrations dynamically
runMigrations()
  .then(() => {
    console.log('Database migrations and patches verified successfully on startup.');
  })
  .catch((err) => {
    console.error('Failed to run database migrations/patches on startup:', err);
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

      await client.query(`
        ALTER TABLE students 
        ADD COLUMN IF NOT EXISTS nic_no VARCHAR(50) UNIQUE;
      `);

      await client.query(`
        ALTER TABLE students 
        ADD COLUMN IF NOT EXISTS attending_convocation BOOLEAN DEFAULT NULL;
      `);

      await client.query(`
        ALTER TABLE degrees ADD COLUMN IF NOT EXISTS faculty VARCHAR(100);
        ALTER TABLE degrees ADD COLUMN IF NOT EXISTS degree_no INT;
      `);

      await client.query(`
        UPDATE degrees SET faculty = 'Faculty of Technology' WHERE faculty IS NULL;
        UPDATE degrees SET degree_no = 1 WHERE degree_no IS NULL;
      `);

      await client.query(`
        ALTER TABLE degrees ALTER COLUMN faculty SET NOT NULL;
        ALTER TABLE degrees ALTER COLUMN degree_no SET NOT NULL;
      `);

      await client.query(`
        ALTER TABLE degrees DROP CONSTRAINT IF EXISTS unique_faculty_degree_no;
        ALTER TABLE degrees ADD CONSTRAINT unique_faculty_degree_no UNIQUE (faculty, degree_no);
      `);

      await client.query(`
        ALTER TABLE degrees ENABLE ROW LEVEL SECURITY;
        ALTER TABLE degrees FORCE ROW LEVEL SECURITY;
      `);

      await client.query(`
        DROP POLICY IF EXISTS select_degrees_policy ON degrees;
        CREATE POLICY select_degrees_policy ON degrees FOR SELECT USING (true);
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
