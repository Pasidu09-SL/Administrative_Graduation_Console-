import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { runAsStudent } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('student_session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(sessionToken);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Unauthorized session' }, { status: 401 });
    }

    const data = await runAsStudent(payload.email, async (client) => {
      const res = await client.query(
        `SELECT s.*, d.code as degree_code, d.name_en as degree_name_en, d.type as degree_type
         FROM students s
         LEFT JOIN degrees d ON s.degree_id = d.id
         WHERE LOWER(s.email) = LOWER($1)`,
        [payload.email]
      );
      return res.rows[0] || null;
    });

    if (!data) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('student_session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(sessionToken);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Unauthorized session' }, { status: 401 });
    }

    const body = await req.json();

    const result = await runAsStudent(payload.email, async (client) => {
      // 1. Get current status to check read-only locking
      const currentRes = await client.query(
        'SELECT attendance_confirmed FROM students WHERE LOWER(email) = LOWER($1)',
        [payload.email]
      );
      const student = currentRes.rows[0];
      if (!student) {
        throw new Error('Student profile not found.');
      }

      if (student.attendance_confirmed) {
        throw new Error('Profile is locked and read-only since attendance has been confirmed.');
      }

      // 2. Prepare patch queries
      const updates: string[] = [];
      const values: any[] = [];
      let index = 1;

      // Allow updating specific student-actionable fields
      if (body.attendance_confirmed !== undefined) {
        updates.push(`attendance_confirmed = $${index}`);
        values.push(body.attendance_confirmed);
        index++;

        if (body.attendance_confirmed === true) {
          updates.push(`confirmed_at = CURRENT_TIMESTAMP`);
          // Mark verification_status back to 'Pending Verification' upon confirmation if it was changed
          updates.push(`verification_status = 'Pending Verification'`);
        }
      }

      if (body.name_correction_request !== undefined) {
        updates.push(`name_correction_request = $${index}`);
        values.push(body.name_correction_request);
        index++;
      }

      if (body.profile_photo_path !== undefined) {
        updates.push(`profile_photo_path = $${index}`);
        values.push(body.profile_photo_path);
        index++;
      }

      if (body.payment_slip_path !== undefined) {
        updates.push(`payment_slip_path = $${index}`);
        values.push(body.payment_slip_path);
        index++;
      }

      if (updates.length === 0) {
        throw new Error('No valid field updates provided.');
      }

      values.push(payload.email);
      const query = `
        UPDATE students
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(email) = LOWER($${index})
        RETURNING *
      `;

      const updateRes = await client.query(query, values);
      return updateRes.rows[0];
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    const isLockedError = err.message.includes('locked');
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: isLockedError ? 403 : 400 });
  }
}
