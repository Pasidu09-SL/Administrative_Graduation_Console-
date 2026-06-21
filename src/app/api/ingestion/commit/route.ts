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

    const activeYearRes = await runAsAdmin(async (client) => {
      return await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
      );
    });
    const activeYear = activeYearRes.rows[0]?.convocation_year || '2026';

    const { degrees, sessions } = await runAsAdmin(async (client) => {
      const degRes = await client.query("SELECT id, type, faculty FROM degrees");
      const sessRes = await client.query("SELECT faculty_1, faculty_2, session_date FROM convocation_sessions");
      return { degrees: degRes.rows, sessions: sessRes.rows };
    });

    const origin = process.env.APP_URL || new URL(req.url).origin;
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
          effective_date,
        } = row;

        const dbIndexNo = index_no === '-' ? null : index_no;
        const dbGpa = gpa === '-' ? null : parseFloat(gpa);

        const deg = degrees.find((d: any) => d.id === degreeId);
        const degType = deg ? deg.type : 'Internal';
        const groupName = degType === 'External' ? 'All External Degrees' : `${faculty} (Internal)`;
        
        // Find session date
        const matchedSession = sessions.find((s: any) => s.faculty_1 === groupName || s.faculty_2 === groupName);
        const graduationDate = matchedSession ? matchedSession.session_date : null;

        const magicToken = signMagicToken(email, registration_no, activeYear);
        const magicLink = `${origin}/api/student/auth/magic-login?email=${encodeURIComponent(email.toLowerCase().trim())}&token=${encodeURIComponent(magicToken)}`;

        notifications.push({
          email,
          index_no: dbIndexNo,
          name: name_with_initials,
          magicLink
        });

        placeholders.push(
          `($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, $${index + 10}, $${index + 11}, $${index + 12}, $${index + 13}, $${index + 14}::date, $${index + 15}::date)`
        );

        values.push(
          name_with_initials,
          full_name,
          registration_no,
          dbIndexNo,
          nic_no,
          faculty,
          degreeId,
          address,
          contact_no,
          email,
          dbGpa,
          classVal,
          magicToken,
          activeYear,
          effective_date || null,
          graduationDate || null
        );
        
        index += 16;
      }

      const query = `
        INSERT INTO students (
          name_with_initials, full_name, registration_no, index_no, nic_no, faculty, degree_id, address, contact_no, email, gpa, class, magic_token, convocation_year, effective_date, graduation_date
        )
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (registration_no, convocation_year) DO UPDATE SET
          index_no = EXCLUDED.index_no,
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
          effective_date = EXCLUDED.effective_date,
          graduation_date = EXCLUDED.graduation_date,
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
