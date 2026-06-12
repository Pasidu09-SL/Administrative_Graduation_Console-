import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

// GET: Fetch all email templates
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrator role required.' }, { status: 401 });
    }

    const data = await runAsAdmin(async (client) => {
      const res = await client.query('SELECT template_key, subject, body, updated_at FROM email_templates ORDER BY template_key ASC');
      return res.rows;
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Update an email template subject and HTML body
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrator role required.' }, { status: 401 });
    }

    const payload = await req.json();
    const templateKey = payload.templateKey || payload.template_key;
    const { subject, body } = payload;

    if (!templateKey || !subject || !body || typeof subject !== 'string' || typeof body !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing or invalid parameters.' }, { status: 400 });
    }

    const data = await runAsAdmin(async (client) => {
      const checkRes = await client.query('SELECT 1 FROM email_templates WHERE template_key = $1', [templateKey]);
      if (checkRes.rows.length === 0) {
        throw new Error(`Email template key '${templateKey}' not found.`);
      }

      const res = await client.query(
        `UPDATE email_templates 
         SET subject = $1, body = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE template_key = $3 
         RETURNING template_key, subject, body, updated_at`,
        [subject.trim(), body, templateKey]
      );
      
      // Log the template update action in the audit logs
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken, student_id)
         VALUES ($1, $2, NULL)`,
        [session.username, `Updated email template for '${templateKey}'`]
      );

      return res.rows[0];
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
