import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { runAsStudent } from '@/lib/db';
import { verifyToken, isRegistrationWindowOpen } from '@/lib/auth';

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
        `SELECT s.*, d.code as degree_code, d.name_en as degree_name_en, d.type as degree_type, d.faculty as degree_faculty, d.degree_no as degree_number
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

    // Check registration window status
    const mockTime = req.headers.get('x-mock-time');
    const { isOpen } = await isRegistrationWindowOpen(mockTime);
    if (!isOpen) {
      return NextResponse.json({
        success: false,
        error: 'Portal Closed: Registration access is currently inactive outside the configured timeline.'
      }, { status: 403 });
    }

    const body = await req.json();

    const result = await runAsStudent(payload.email, async (client) => {
      // 1. Get current status to check read-only locking
      const currentRes = await client.query(
        'SELECT attendance_confirmed, attending_convocation, profile_photo_path, payment_slip_path FROM students WHERE LOWER(email) = LOWER($1)',
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
      if (body.attending_convocation !== undefined) {
        updates.push(`attending_convocation = $${index}`);
        values.push(body.attending_convocation);
        index++;
      }

      if (body.attendance_confirmed !== undefined) {
        updates.push(`attendance_confirmed = $${index}`);
        values.push(body.attendance_confirmed);
        index++;

        if (body.attendance_confirmed === true) {
          const isAttending = body.attending_convocation !== undefined ? body.attending_convocation : student.attending_convocation;
          if (isAttending === null || isAttending === undefined) {
            throw new Error('Please choose whether you will attend the convocation.');
          }

          // Profile photo and payment slip are required for all students (attending or not)
          const photoPath = body.profile_photo_path !== undefined ? body.profile_photo_path : student.profile_photo_path;
          const slipPath = body.payment_slip_path !== undefined ? body.payment_slip_path : student.payment_slip_path;
          if (!photoPath || !slipPath) {
            throw new Error('Profile photo and payment slip are required before submitting your response.');
          }

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
