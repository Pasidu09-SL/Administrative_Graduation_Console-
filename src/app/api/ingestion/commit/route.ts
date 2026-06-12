import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { signMagicToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No data rows provided to commit.' }, { status: 400 });
    }

    const startTime = Date.now();

    const activeYear = await runAsAdmin(async (client) => {
      const activeYearRes = await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
      );
      return activeYearRes.rows[0]?.convocation_year || '2026';
    });

    const { origin } = new URL(req.url);
    const notifications: any[] = [];

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

        const magicToken = signMagicToken(email, index_no);
        const magicLink = `${origin}/api/student/auth/magic-login?email=${encodeURIComponent(email.toLowerCase().trim())}&token=${encodeURIComponent(magicToken)}`;

        notifications.push({
          email,
          index_no,
          name: name_with_initials,
          magicLink
        });

        placeholders.push(
          `($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, $${index + 10}, $${index + 11}, $${index + 12}, $${index + 13})`
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
          classVal,
          magicToken,
          activeYear
        );
        
        index += 14;
      }

      const query = `
        INSERT INTO students (
          name_with_initials, full_name, registration_no, index_no, nic_no, faculty, degree_id, address, contact_no, email, gpa, class, magic_token, convocation_year
        )
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (index_no, convocation_year) DO UPDATE SET
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
          magic_token = EXCLUDED.magic_token,
          updated_at = CURRENT_TIMESTAMP
      `;

      await client.query(query, values);
    });

    const durationMs = Date.now() - startTime;

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
