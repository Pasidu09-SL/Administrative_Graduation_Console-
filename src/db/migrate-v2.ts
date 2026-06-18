import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function main() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local file not found!');
    process.exit(1);
  }

  // Load the current connection string pointing to postgres
  const envContent = fs.readFileSync(envPath, 'utf8');
  let currentDbUrl = '';
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('DATABASE_URL')) {
      const parts = trimmed.split('=');
      currentDbUrl = parts.slice(1).join('=').replace(/^['"]|['"]$/g, '').trim();
    }
  }

  if (!currentDbUrl) {
    console.error('DATABASE_URL not found in .env.local!');
    process.exit(1);
  }

  console.log(`Connecting to database...`);
  const client = new Client({ connectionString: currentDbUrl });
  await client.connect();

  try {
    console.log('Altering convocation_sessions table to add new columns...');
    await client.query(`
      ALTER TABLE convocation_sessions ADD COLUMN IF NOT EXISTS session_date VARCHAR(100);
      ALTER TABLE convocation_sessions ADD COLUMN IF NOT EXISTS session_time VARCHAR(100);
      ALTER TABLE convocation_sessions ADD COLUMN IF NOT EXISTS faculty_1 VARCHAR(255);
      ALTER TABLE convocation_sessions ADD COLUMN IF NOT EXISTS faculty_2 VARCHAR(255);
    `);
    console.log('convocation_sessions table altered successfully.');

    console.log('Seeding in_absentia email template...');
    const inAbsentiaBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Registration Confirmed - In Absentia</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; } .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; } .details-row:last-child { border-bottom: none; } .details-label { font-size: 13px; color: #64748b; font-weight: 600; } .details-value { font-size: 14px; color: #0f172a; font-weight: 700; font-family: monospace; } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style></head><body><div class="container"><div class="header"><h1>Registration Confirmed</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Your graduation registration details have been verified and approved by the Exam Division. Since you chose to graduate in absentia (not attending the convocation ceremony), your certificate has been allocated:</p><div class="details-card"><div class="details-row"><span class="details-label">Graduation Status:</span><span class="details-value">In Absentia</span></div><div class="details-row"><span class="details-label">Certificate Number:</span><span class="details-value">{{certificate_number}}</span></div></div><p class="text">Please contact the Exam Division office to collect your certificate or for instructions regarding certificate postage details.</p></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>`;

    await client.query(`
      INSERT INTO email_templates (template_key, subject, body)
      VALUES ('in_absentia', 'Graduation Registration Confirmed - In Absentia', $1)
      ON CONFLICT (template_key) DO NOTHING
    `, [inAbsentiaBody]);
    console.log('in_absentia email template seeded successfully.');

  } catch (err: any) {
    console.error('Error executing database v2 migrations:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  console.log('Database V2 migration successfully completed!');
}

main();
