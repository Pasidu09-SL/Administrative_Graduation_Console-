import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession, signMagicToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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

    const { degrees, sessions, allocatedGroups } = await runAsAdmin(async (client) => {
      const degRes = await client.query("SELECT id, type, faculty FROM degrees");
      const sessRes = await client.query("SELECT faculty_1, faculty_2, session_date FROM convocation_sessions");
      
      // Determine which groups have seating allocated already for active year
      const seatingRes = await client.query(
        `SELECT DISTINCT s.faculty, d.type as degree_type
         FROM students s
         JOIN degrees d ON s.degree_id = d.id
         WHERE s.seat_number IS NOT NULL AND s.convocation_year = $1`,
        [activeYear]
      );
      const allocated = new Set<string>();
      for (const row of seatingRes.rows) {
        if (row.degree_type === 'External') {
          allocated.add('All External Degrees');
        } else {
          allocated.add(`${row.faculty} (Internal)`);
        }
      }

      return { 
        degrees: degRes.rows, 
        sessions: sessRes.rows,
        allocatedGroups: allocated
      };
    });

    const origin = process.env.NODE_ENV === 'production' 
      ? 'https://graduation-portal.duzb.me' 
      : 'http://localhost:3000'; // Fallback for local testing environment

    // Sort onboarded students by class (First Class first, then Second Upper, then Second Lower, then Pass) and GPA descending
    const getClassPriority = (cls: string = '') => {
      const c = (cls || '').toLowerCase();
      if (c.includes('first')) return 1;
      if (c.includes('upper') || c.includes('second class (upper') || c.includes('second class upper') || c.includes('second division upper')) return 2;
      if (c.includes('lower') || c.includes('second class (lower') || c.includes('second class lower') || c.includes('second division lower')) return 3;
      return 4; // Pass, General, Ordinary, etc.
    };

    rows.sort((a: any, b: any) => {
      const pA = getClassPriority(a.class);
      const pB = getClassPriority(b.class);
      if (pA !== pB) return pA - pB;
      const gpaA = a.gpa === '-' || a.gpa === undefined || a.gpa === null ? 0 : parseFloat(a.gpa);
      const gpaB = b.gpa === '-' || b.gpa === undefined || b.gpa === null ? 0 : parseFloat(b.gpa);
      return gpaB - gpaA;
    });

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

        // Determine if this is a late addition
        const isLate = allocatedGroups.has(groupName);

        const magicToken = signMagicToken(email, registration_no, activeYear);
        const magicLink = `${origin}/api/student/auth/magic-login?email=${encodeURIComponent(email.toLowerCase().trim())}&token=${encodeURIComponent(magicToken)}`;

        notifications.push({
          email,
          index_no: dbIndexNo,
          name: name_with_initials,
          magicLink
        });

        placeholders.push(
          `($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, $${index + 10}, $${index + 11}, $${index + 12}, $${index + 13}, $${index + 14}::date, $${index + 15}::date, $${index + 16}::boolean)`
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
          graduationDate || null,
          isLate
        );
        
        index += 17;
      }

      const query = `
        INSERT INTO students (
          name_with_initials, full_name, registration_no, index_no, nic_no, faculty, degree_id, address, contact_no, email, gpa, class, magic_token, convocation_year, effective_date, graduation_date, is_late_addition
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
          is_late_addition = EXCLUDED.is_late_addition,
          updated_at = CURRENT_TIMESTAMP
      `;

      await client.query(query, values);

      // Audit logging for bulk import
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken)
         VALUES ($1, $2)`,
        [session.username, `Bulk onboarded ${rows.length} candidates via Excel sheet for convocation year ${activeYear}`]
      );
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
