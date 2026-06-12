import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession, signMagicToken } from '@/lib/auth';
import { sendEmail, getRejectionTemplate } from '@/lib/email';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const faculty = searchParams.get('faculty');
    const degreeId = searchParams.get('degreeId');
    const status = searchParams.get('status');
    const attending = searchParams.get('attending');
    const responseStatus = searchParams.get('responseStatus');
    const convocationYear = searchParams.get('convocationYear');
    const sessionNum = searchParams.get('session');

    const data = await runAsAdmin(async (client) => {
      const activeYearRes = await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
      );
      const activeYear = activeYearRes.rows[0]?.convocation_year || '2026';
      const yearToFilter = convocationYear || activeYear;

      const conditions: string[] = [];
      const values: any[] = [];
      let index = 1;

      conditions.push(`s.convocation_year = $${index}`);
      values.push(yearToFilter);
      index++;

      if (faculty) {
        conditions.push(`s.faculty = $${index}`);
        values.push(faculty);
        index++;
      }
      if (degreeId) {
        conditions.push(`s.degree_id = $${index}`);
        values.push(degreeId);
        index++;
      }
      if (status) {
        conditions.push(`s.verification_status = $${index}`);
        values.push(status);
        index++;
      }
      if (attending !== null && attending !== undefined && attending !== '') {
        conditions.push(`s.attending_convocation = $${index}`);
        values.push(attending === 'true');
        index++;
      }
      if (sessionNum && !isNaN(parseInt(sessionNum, 10))) {
        conditions.push(`s.session_number = $${index}`);
        values.push(parseInt(sessionNum, 10));
        index++;
      }
      if (responseStatus === 'pending') {
        conditions.push(`s.attendance_confirmed = false`);
      } else if (responseStatus === 'submitted') {
        conditions.push(`s.attendance_confirmed = true`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT s.*, d.code as degree_code, d.name_en as degree_name_en, d.type as degree_type, d.faculty as degree_faculty, d.degree_no as degree_number
        FROM students s
        LEFT JOIN degrees d ON s.degree_id = d.id
        ${whereClause}
        ORDER BY s.index_no ASC
      `;

      const res = await client.query(query, values);
      return res.rows;
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { studentId, action, rejectReason, bypassState } = await req.json();
    const adminId = session.username;

    if (!studentId || !action) {
      return NextResponse.json({ success: false, error: 'Student ID and Action are required.' }, { status: 400 });
    }

    const result = await runAsAdmin(async (client) => {
      // 1. Get original student details
      const studentRes = await client.query('SELECT * FROM students WHERE id = $1', [studentId]);
      const student = studentRes.rows[0];
      if (!student) {
        throw new Error('Student record not found.');
      }

      let actionText = '';
      if (action === 'approve') {
        if (!student.attendance_confirmed) {
          throw new Error('Cannot approve student who has not filled and submitted their registration details.');
        }
        const oldName = student.full_name;
        const newName = student.name_correction_request ? student.name_correction_request.trim() : student.full_name;

        // Update student record: Approve and update full name if correction request existed
        await client.query(
          `UPDATE students
           SET verification_status = 'Approved',
               full_name = $1,
               name_correction_request = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [newName, studentId]
        );

        actionText = `Approved student profile.`;
        if (oldName !== newName) {
          actionText += ` Name updated from "${oldName}" to "${newName}".`;
        }
      } else if (action === 'revoke') {
        // Revoke approval: reset verification_status to 'Pending Verification', and clear session, seat, and certificate numbers
        await client.query(
          `UPDATE students
           SET verification_status = 'Pending Verification',
               session_number = NULL,
               seat_number = NULL,
               certificate_number = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [studentId]
        );
        actionText = `Revoked student approval. Seating and certificate allocation cleared.`;
      } else if (action === 'reject') {
        const reason = rejectReason || 'No reason provided';
        
        // Rejects changes, sets status, and UNLOCKS profile (re-enabling attendance_confirmed = false)
        await client.query(
          `UPDATE students
           SET verification_status = 'Name Correction Requested',
               attendance_confirmed = FALSE,
               confirmed_at = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [studentId]
        );

        actionText = `Rejected changes & unlocked profile. Reason: "${reason}".`;

        // Dispatch correction alert email via Brevo
        const { origin } = new URL(req.url);
        const token = signMagicToken(student.email, student.index_no);
        const correctionUrl = `${origin}/?email=${encodeURIComponent(student.email)}&token=${token}`;
        try {
          const tempRes = await client.query('SELECT subject, body FROM email_templates WHERE template_key = $1', ['rejection']);
          const customTemplate = tempRes.rows[0];
          let subject = 'Correction Required: Graduation Profile Update Alert';
          let htmlContent = '';
          if (customTemplate) {
            subject = customTemplate.subject;
            htmlContent = customTemplate.body
              .replace(/\{\{student_name\}\}/g, student.name_with_initials)
              .replace(/\{\{rejection_reason\}\}/g, reason)
              .replace(/\{\{login_url\}\}/g, correctionUrl);
          } else {
            htmlContent = await getRejectionTemplate(student.name_with_initials, reason, correctionUrl);
          }

          await sendEmail({
            to: [{ email: student.email, name: student.name_with_initials }],
            subject,
            htmlContent
          });
        } catch (err: any) {
          console.error(`Failed to send rejection email to ${student.email}:`, err.message);
        }
      } else if (action === 'toggle_bypass') {
        const nextBypass = !!bypassState;
        await client.query(
          `UPDATE students
           SET timeline_bypass = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [nextBypass, studentId]
        );
        actionText = nextBypass
          ? `Granted timeline window bypass to candidate.`
          : `Revoked timeline window bypass from candidate.`;
      } else {
        throw new Error('Invalid action type.');
      }

      // 2. Insert into audit logs
      const logRes = await client.query(
        `INSERT INTO audit_logs (admin_id, student_id, action_taken)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [adminId, studentId, actionText]
      );

      return {
        studentId,
        verificationStatus: student.verification_status,
        auditLog: logRes.rows[0]
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { studentId, studentIds } = await req.json();
    const adminId = session.username;

    if (!studentId && (!studentIds || studentIds.length === 0)) {
      return NextResponse.json({ success: false, error: 'Either studentId or studentIds must be provided.' }, { status: 400 });
    }

    const idsToDelete = studentIds ? studentIds : [studentId];

    await runAsAdmin(async (client) => {
      // Fetch details of students to log their deletion and retrieve files to delete
      const studentsRes = await client.query(
        'SELECT index_no, full_name, faculty, email, profile_photo_path, payment_slip_path FROM students WHERE id = ANY($1)',
        [idsToDelete]
      );
      
      // Delete the students (related records in audit_logs are cascade deleted because of REFERENCES students(id) ON DELETE CASCADE)
      await client.query('DELETE FROM students WHERE id = ANY($1)', [idsToDelete]);

      // Write a system audit log for the deletion action and clean up OTP and files
      for (const st of studentsRes.rows) {
        await client.query(
          `INSERT INTO audit_logs (admin_id, action_taken)
           VALUES ($1, $2)`,
          [adminId, `Deleted student from registry: Index No=${st.index_no}, Name=${st.full_name}, Faculty=${st.faculty}`]
        );

        // Delete their OTP codes from the database
        await client.query('DELETE FROM otp_codes WHERE LOWER(email) = LOWER($1)', [st.email.toLowerCase().trim()]);

        // Clean up uploaded files from disk
        try {
          if (st.profile_photo_path) {
            const photoPath = path.join(process.cwd(), 'public', st.profile_photo_path);
            if (fs.existsSync(photoPath)) {
              fs.unlinkSync(photoPath);
            }
          }
          if (st.payment_slip_path) {
            const slipPath = path.join(process.cwd(), 'public', st.payment_slip_path);
            if (fs.existsSync(slipPath)) {
              fs.unlinkSync(slipPath);
            }
          }
        } catch (fileErr) {
          console.error("Failed to delete student uploaded files:", fileErr);
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
