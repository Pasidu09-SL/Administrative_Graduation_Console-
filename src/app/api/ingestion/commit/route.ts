import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { signMagicToken } from '@/lib/auth';
import { sendEmail, getMagicLinkTemplate } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No data rows provided to commit.' }, { status: 400 });
    }

    const startTime = Date.now();

    await runAsAdmin(async (client) => {
      // Build batch insert query
      const values: any[] = [];
      const placeholders: string[] = [];
      let index = 1;

      for (const row of rows) {
        const {
          name_with_initials,
          full_name,
          registration_no,
          index_no,
          nic_no,
          faculty,
          degreeId,
          address,
          contact_no,
          email,
          gpa,
          class: classVal,
        } = row;

        placeholders.push(
          `($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, $${index + 10}, $${index + 11})`
        );

        values.push(
          name_with_initials,
          full_name,
          registration_no,
          index_no,
          nic_no,
          faculty,
          degreeId,
          address,
          contact_no,
          email,
          parseFloat(gpa),
          classVal
        );
        
        index += 12;
      }

      const query = `
        INSERT INTO students (
          name_with_initials, full_name, registration_no, index_no, nic_no, faculty, degree_id, address, contact_no, email, gpa, class
        )
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (index_no) DO UPDATE SET
          registration_no = EXCLUDED.registration_no,
          nic_no = EXCLUDED.nic_no,
          email = EXCLUDED.email,
          name_with_initials = EXCLUDED.name_with_initials,
          full_name = EXCLUDED.full_name,
          faculty = EXCLUDED.faculty,
          degree_id = EXCLUDED.degree_id,
          address = EXCLUDED.address,
          contact_no = EXCLUDED.contact_no,
          gpa = EXCLUDED.gpa,
          class = EXCLUDED.class,
          updated_at = CURRENT_TIMESTAMP
      `;

      await client.query(query, values);
    });

    const durationMs = Date.now() - startTime;
    const { origin } = new URL(req.url);
    const notifications = [];
    for (const row of rows) {
      const magicToken = signMagicToken(row.email, row.index_no);
      const magicLink = `${origin}/api/student/auth/magic-login?email=${encodeURIComponent(row.email.toLowerCase().trim())}&token=${encodeURIComponent(magicToken)}`;

      try {
        // Dispatch magic link email via Brevo
        await sendEmail({
          to: [{ email: row.email.toLowerCase().trim(), name: row.name_with_initials }],
          subject: 'Convocation Registration - Action Required',
          htmlContent: getMagicLinkTemplate(row.name_with_initials, magicLink)
        });
      } catch (err: any) {
        console.error(`Failed to send onboarding email to ${row.email}:`, err.message);
      }

      notifications.push({
        email: row.email,
        index_no: row.index_no,
        name: row.name_with_initials,
        magicLink
      });
    }

    return NextResponse.json({
      success: true,
      count: rows.length,
      durationMs,
      notifications
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
