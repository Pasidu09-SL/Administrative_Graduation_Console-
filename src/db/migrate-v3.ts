import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function main() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local file not found!');
    process.exit(1);
  }

  // Load database url
  const envContent = fs.readFileSync(envPath, 'utf8');
  let dbUrl = '';
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('DATABASE_URL')) {
      const parts = trimmed.split('=');
      dbUrl = parts.slice(1).join('=').replace(/^['"]|['"]$/g, '').trim();
    }
  }

  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env.local!');
    process.exit(1);
  }

  console.log(`Connecting to database...`);
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    console.log('Altering students table to add effective_date and graduation_date columns...');
    await client.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS effective_date DATE;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS graduation_date DATE;
    `);
    console.log('students table altered successfully.');

    console.log('Seeding updated magic_link email template...');
    const magicLinkBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Graduation Onboarding Portal</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; } .container { max-width: 580px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); } .header { background: #1e3a8a; padding: 32px; text-align: center; } .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; } .body { padding: 40px 32px; } .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; } .text { font-size: 15px; color: #334155; line-height: 1.6; } .cta-area { text-align: center; margin: 36px 0; } .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2); } .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }</style></head><body><div class="container"><div class="header"><h1>University Graduation Portal</h1></div><div class="body"><p class="greeting">Dear {{student_name}},</p><p class="text">Your academic records have been successfully verified and imported into the Graduation Registry. Registration for the upcoming convocation is now open.</p>{{session_details_table}}<p class="text">Please click the button below to enter your secure portal, verify your billing address, confirm names translation, upload certificates documentation, and lock your seating seat number allocation:</p><div class="cta-area"><a href="{{magic_link_url}}" class="button" target="_blank">Access Graduation Portal</a></div><p class="text"><em>Note: This magic link is cryptographically tied to your email and is valid for 7 days. Do not share this email with others.</em></p></div><div class="footer">&copy; 2026 University Exam Division. This email was sent automatically.</div></div></body></html>`;

    await client.query(`
      INSERT INTO email_templates (template_key, subject, body)
      VALUES ('magic_link', 'Convocation Registration - Action Required', $1)
      ON CONFLICT (template_key) DO UPDATE SET body = EXCLUDED.body;
    `, [magicLinkBody]);
    console.log('magic_link email template updated successfully.');

  } catch (err: any) {
    console.error('Error executing database v3 migrations:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  console.log('Database V3 migration successfully completed!');
}

main();
