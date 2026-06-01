import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const faculty = searchParams.get('faculty');
    const degreeId = searchParams.get('degreeId');
    const status = searchParams.get('status');

    const data = await runAsAdmin(async (client) => {
      const conditions: string[] = [];
      const values: any[] = [];
      let index = 1;

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

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT s.*, d.code as degree_code, d.name_en as degree_name_en, d.type as degree_type
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
    const { studentId, action, rejectReason, adminId = 'ADMIN_EXAM_DIV' } = await req.json();

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

        // Simulate sending email alert
        console.log(`[MOCK EMAIL SERVICE] 
          To: ${student.email}
          Subject: Graduation Profile Rejected & Unlocked
          Body: Your submitted details for graduation graduation registration were rejected. 
          Reason: ${reason}
          Your profile has been unlocked. Please login to the student portal to correct your information and re-confirm attendance.`);
      } else {
        throw new Error('Invalid action type. Must be approve or reject.');
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
        verificationStatus: action === 'approve' ? 'Approved' : 'Name Correction Requested',
        auditLog: logRes.rows[0]
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
