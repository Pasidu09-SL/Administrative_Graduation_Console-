import { Pool, PoolClient } from "pg";
import fs from "fs";
import path from "path";

// Load .env.local programmatically if DATABASE_URL is not set (e.g. when executing standalone scripts)
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...parts] = trimmed.split("=");
          const val = parts.join("=").replace(/^['"]|['"]$/g, "");
          process.env[key.trim()] = val.trim();
        }
      }
    }
  } catch (err) {
    console.error("Failed to load .env.local file programmatically:", err);
  }
}

// PostgreSQL connection config
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/postgres";

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Auto-run migrations on startup to apply schema patches/migrations dynamically
if (process.env.IS_TEST_RUNNER !== "true" && process.env.NEXT_PHASE !== "phase-production-build") {
  runMigrations()
    .then(() => {
      console.log(
        "Database migrations and patches verified successfully on startup.",
      );
    })
    .catch((err) => {
      console.error(
        "Failed to run database migrations/patches on startup:",
        err,
      );
    });
}

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
      console.log("Database tables do not exist. Running migrations...");
      // Read migrations.sql file path
      const sqlPath = path.join(process.cwd(), "src/db/migrations.sql");
      const sql = fs.readFileSync(sqlPath, "utf8");
      await client.query(sql);
      console.log("Migrations completed successfully.");
    } else {
      console.log("Database tables already exist. Checking schema patches...");
      // Self-healing schema updates for existing databases
      await client.query(`
        ALTER TABLE registration_windows 
        ADD COLUMN IF NOT EXISTS is_manually_closed BOOLEAN DEFAULT FALSE;
      `);

      await client.query(`
        ALTER TABLE students 
        ADD COLUMN IF NOT EXISTS nic_no VARCHAR(50);
      `);

      await client.query(`
        ALTER TABLE students 
        ADD COLUMN IF NOT EXISTS attending_convocation BOOLEAN DEFAULT NULL;
      `);

      await client.query(`
        ALTER TABLE degrees ADD COLUMN IF NOT EXISTS faculty VARCHAR(100);
        ALTER TABLE degrees ADD COLUMN IF NOT EXISTS degree_no INT;
        ALTER TABLE degrees ADD COLUMN IF NOT EXISTS import_order SERIAL;
      `);

      await client.query(`
        ALTER TABLE audit_logs ALTER COLUMN student_id DROP NOT NULL;
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

      await client.query(`
        UPDATE degrees SET faculty = 'Faculty of Applied Sciences' WHERE faculty = 'Faculty of Applied Science';
        UPDATE degrees SET faculty = 'Faculty of Social Sciences & Humanities' WHERE faculty = 'Faculty of Social Science and Humanities';
        UPDATE degrees SET faculty = 'Faculty of Medicine and Allied Sciences' WHERE faculty = 'Faculty of Medicine and Allied Science';

        UPDATE students SET faculty = 'Faculty of Applied Sciences' WHERE faculty = 'Faculty of Applied Science';
        UPDATE students SET faculty = 'Faculty of Social Sciences & Humanities' WHERE faculty = 'Faculty of Social Science and Humanities';
        UPDATE students SET faculty = 'Faculty of Medicine and Allied Sciences' WHERE faculty = 'Faculty of Medicine and Allied Science';
      `);

      // 1. Create faculties, convocation_sessions, email_templates tables if they don't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS faculties (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        INSERT INTO faculties (name) VALUES
          ('Faculty of Agriculture'),
          ('Faculty of Applied Sciences'),
          ('Faculty of Management Studies'),
          ('Faculty of Medicine and Allied Sciences'),
          ('Faculty of Social Sciences & Humanities'),
          ('Faculty of Technology')
        ON CONFLICT (name) DO NOTHING;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS convocation_sessions (
          id SERIAL PRIMARY KEY,
          session_number INT UNIQUE NOT NULL,
          session_name VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Self-healing patch: Drop NOT NULL constraint on allocation_group if it exists
      await client.query(`
        DO $$ 
        BEGIN 
            IF EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name='convocation_sessions' AND column_name='allocation_group'
            ) THEN 
                ALTER TABLE convocation_sessions ALTER COLUMN allocation_group DROP NOT NULL;
            END IF; 
        END $$;
      `);

      await client.query(`
        INSERT INTO convocation_sessions (session_number, session_name) VALUES
          (1, 'Session 1'),
          (2, 'Session 2'),
          (3, 'Session 3'),
          (4, 'Session 4')
        ON CONFLICT (session_number) DO NOTHING;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS email_templates (
          template_key VARCHAR(50) PRIMARY KEY,
          subject VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query(`
        INSERT INTO email_templates (template_key, subject, body) VALUES
          ('otp', 'Verification Code', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Verification Code</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .intro { font-size: 15px; color: #334155; line-height: 1.6; margin-top: 0; } .otp-card { background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin: 32px 0; border: 1px dashed #cbd5e1; } .otp-code { font-size: 32px; font-weight: 800; color: #1e3a8a; letter-spacing: 6px; font-family: Courier, monospace; margin: 0; } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; } .alert { color: #ef4444; font-weight: 600; margin-top: 16px; font-size: 13px; }</style></head><body><div class="container"><div class="header"><h1>University Graduation Portal</h1></div><div class="body"><p class="intro">Hello student,</p><p class="intro">You requested a verification code to access your Graduation Self-Service Portal. Please use the following single-use passcode:</p><div class="otp-card"><div class="otp-code">{{otp_code}}</div></div><p class="intro">This code is cryptographically locked to your session and will automatically expire in <strong>5 minutes</strong>.</p><p class="alert">If you did not initiate this request, please ignore this email immediately.</p></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>'),
          ('magic_link', 'Convocation Registration - Action Required', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Graduation Onboarding Portal</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .cta-area { text-align: center; margin: 36px 0; } .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2); } .link-fallback { background: #f8fafc; border-radius: 8px; padding: 16px; font-size: 12px; color: #64748b; word-break: break-all; margin-top: 24px; border: 1px solid #e2e8f0; } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style></head><body><div class="container"><div class="header"><h1>University Graduation Portal</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Your academic records have been successfully verified and imported into the Graduation Registry. Registration for the upcoming convocation is now open.</p><p class="text">Please click the button below to enter your secure portal, verify your billing address, confirm names translation, upload certificates documentation, and lock your seating seat number allocation:</p><div class="cta-area"><a href="{{magic_link_url}}" class="button" target="_blank">Access Graduation Portal</a></div><p class="text"><em>Note: This magic link is cryptographically tied to your email and is valid for 7 days. Do not share this email with others.</em></p><div class="link-fallback"><strong>Button not working?</strong> Copy and paste this URL into your browser:<br><span style="user-select: all;">{{magic_link_url}}</span></div></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>'),
          ('rejection', 'Graduation Registration Rejected', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Graduation Registration Rejected</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #b91c1c; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .reason-card { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 20px; text-align: left; margin: 28px 0; } .reason-title { font-weight: 700; color: #991b1b; font-size: 14px; margin-bottom: 6px; } .reason-text { font-size: 13.5px; color: #7f1d1d; line-height: 1.5; margin: 0; } .cta-area { text-align: center; margin: 36px 0; } .button { display: inline-block; background-color: #dc2626; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 10px rgba(220, 38, 38, 0.2); } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style></head><body><div class="container"><div class="header"><h1>Graduation Registry Correction Alert</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Upon review by the Exam Division Coordinator, your graduation registration details have been <strong>rejected and unlocked for editing</strong>.</p><div class="reason-card"><div class="reason-title">Reason for spelling or document rejection:</div><p class="reason-text">{{rejection_reason}}</p></div><p class="text">Your profile has been temporarily unlocked. Please click the button below to log back into your portal, edit your details, upload correct documentation (photographs/payment slips), and re-submit your registration for confirmation:</p><div class="cta-area"><a href="{{login_url}}" class="button" target="_blank">Correct Registration Details</a></div></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>'),
          ('confirmation', 'Graduation Registration Confirmed - Seating Allocation', '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Registration Confirmed</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; } .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; } .details-row:last-child { border-bottom: none; } .details-label { font-size: 13px; color: #64748b; font-weight: 600; } .details-value { font-size: 14px; color: #0f172a; font-weight: 700; font-family: monospace; } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style></head><body><div class="container"><div class="header"><h1>Registration Confirmed</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Your graduation registration details have been verified and approved by the Exam Division. Your seating and session allocation has been finalized:</p><div class="details-card"><div class="details-row"><span class="details-label">Session Number:</span><span class="details-value">Session {{session_number}}</span></div><div class="details-row"><span class="details-label">Seat Number:</span><span class="details-value">Seat {{seat_number}}</span></div><div class="details-row"><span class="details-label">Certificate Number:</span><span class="details-value">{{certificate_number}}</span></div></div><p class="text">Please present this information at the entrance. We look forward to seeing you at the convocation ceremony.</p></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>')
        ON CONFLICT (template_key) DO NOTHING;
      `);

      // 2. Add columns to registration_windows
      await client.query(`
        ALTER TABLE registration_windows ADD COLUMN IF NOT EXISTS convocation_year VARCHAR(50) DEFAULT '2026';
        ALTER TABLE registration_windows ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      `);
      // Deduplicate registration_windows if duplicates exist for convocation_year
      await client.query(`
        DELETE FROM registration_windows a USING registration_windows b 
        WHERE a.id < b.id AND a.convocation_year = b.convocation_year;
      `);
      await client.query(`
        ALTER TABLE registration_windows DROP CONSTRAINT IF EXISTS unique_convocation_year;
        ALTER TABLE registration_windows ADD CONSTRAINT unique_convocation_year UNIQUE (convocation_year);
      `);
      await client.query(`
        DROP INDEX IF EXISTS idx_active_convocation;
        CREATE UNIQUE INDEX idx_active_convocation ON registration_windows(is_active) WHERE is_active = TRUE;
      `);

      // 3. Add columns to staff
      await client.query(`
        ALTER TABLE staff ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled'));
      `);

      // 4. Add columns to students
      await client.query(`
        ALTER TABLE students ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS magic_token TEXT DEFAULT NULL;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS convocation_year VARCHAR(50) DEFAULT '2026';
        ALTER TABLE students ADD COLUMN IF NOT EXISTS confirmation_email_sent BOOLEAN DEFAULT FALSE;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS import_order SERIAL;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS timeline_bypass BOOLEAN DEFAULT FALSE;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS is_late_addition BOOLEAN DEFAULT FALSE;
      `);

      // Make index_no and gpa nullable
      await client.query(`
        ALTER TABLE students ALTER COLUMN index_no DROP NOT NULL;
        ALTER TABLE students ALTER COLUMN gpa DROP NOT NULL;
      `);

      // 5. Relax session constraint on students
      await client.query(`
        ALTER TABLE students DROP CONSTRAINT IF EXISTS students_session_number_check;
        ALTER TABLE students ADD CONSTRAINT students_session_number_check CHECK (session_number > 0);
      `);

      // 6. Refactor unique constraints on students to composite per convocation_year
      await client.query(`
        ALTER TABLE students DROP CONSTRAINT IF EXISTS students_index_no_key;
        ALTER TABLE students DROP CONSTRAINT IF EXISTS students_nic_no_key;
        ALTER TABLE students DROP CONSTRAINT IF EXISTS students_registration_no_key;
        ALTER TABLE students DROP CONSTRAINT IF EXISTS students_email_key;

        ALTER TABLE students DROP CONSTRAINT IF EXISTS unique_index_no_convocation;
        ALTER TABLE students ADD CONSTRAINT unique_index_no_convocation UNIQUE (index_no, convocation_year);

        ALTER TABLE students DROP CONSTRAINT IF EXISTS unique_nic_no_convocation;
        ALTER TABLE students ADD CONSTRAINT unique_nic_no_convocation UNIQUE (nic_no, convocation_year);

        ALTER TABLE students DROP CONSTRAINT IF EXISTS unique_registration_no_convocation;
        ALTER TABLE students ADD CONSTRAINT unique_registration_no_convocation UNIQUE (registration_no, convocation_year);

        ALTER TABLE students DROP CONSTRAINT IF EXISTS unique_email_convocation;
        ALTER TABLE students ADD CONSTRAINT unique_email_convocation UNIQUE (email, convocation_year);
      `);

      // 7. Create certificate_layouts table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS certificate_layouts (
          convocation_year VARCHAR(50) PRIMARY KEY,
          layout_data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  } catch (err) {
    console.error("Error running migrations:", err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute db queries under Row Level Security context for a specific student.
 */
export async function runAsStudent<T>(
  email: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.is_admin', 'false', true)");
    await client.query(
      "SELECT set_config('app.current_student_email', $1, true)",
      [email],
    );
    await client.query("SET LOCAL ROLE app_user");
    const res = await fn(client);
    await client.query("COMMIT");
    return res;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute db queries under admin context (which bypasses student RLS filtering).
 */
export async function runAsAdmin<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.is_admin', 'true', true)");
    await client.query(
      "SELECT set_config('app.current_student_email', '', true)",
    );
    const res = await fn(client);
    await client.query("COMMIT");
    return res;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Log an administrative action to the audit logs table.
 */
export async function logAuditAction(
  adminId: string,
  action: string,
  studentId: string | null = null
): Promise<void> {
  await runAsAdmin(async (client) => {
    await client.query(
      `INSERT INTO audit_logs (admin_id, action_taken, student_id) 
       VALUES ($1, $2, $3)`,
      [adminId, action, studentId]
    );
  });
}
