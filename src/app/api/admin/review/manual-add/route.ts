import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession, signMagicToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      registration_no,
      index_no,
      nic_no,
      email,
      name_with_initials,
      full_name,
      faculty,
      degree_id,
      address,
      contact_no,
      gpa,
      class: classVal,
      effective_date
    } = body;

    // Basic required validation
    if (!registration_no || !nic_no || !email || !name_with_initials || !full_name || !faculty || !degree_id || !address || !contact_no || !classVal) {
      return NextResponse.json({ success: false, error: 'All fields except Index No and GPA are required.' }, { status: 400 });
    }

    const activeYearRes = await runAsAdmin(async (client) => {
      return await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
      );
    });
    const activeYear = activeYearRes.rows[0]?.convocation_year || '2026';

    const result = await runAsAdmin(async (client) => {
      // Check duplicate registration_no
      const checkReg = await client.query(
        'SELECT 1 FROM students WHERE registration_no = $1 AND convocation_year = $2',
        [registration_no.trim(), activeYear]
      );
      if (checkReg.rows.length > 0) {
        throw new Error(`Registration No '${registration_no}' already exists for convocation year ${activeYear}.`);
      }

      // Check duplicate index_no
      if (index_no && index_no.trim() !== '') {
        const checkIdx = await client.query(
          'SELECT 1 FROM students WHERE index_no = $1 AND convocation_year = $2',
          [index_no.trim(), activeYear]
        );
        if (checkIdx.rows.length > 0) {
          throw new Error(`Index No '${index_no}' already exists for convocation year ${activeYear}.`);
        }
      }

      // Check duplicate nic_no
      const checkNic = await client.query(
        'SELECT 1 FROM students WHERE nic_no = $1 AND convocation_year = $2',
        [nic_no.trim(), activeYear]
      );
      if (checkNic.rows.length > 0) {
        throw new Error(`NIC No '${nic_no}' already exists for convocation year ${activeYear}.`);
      }

      // Check duplicate email
      const checkEmail = await client.query(
        'SELECT 1 FROM students WHERE email = $1 AND convocation_year = $2',
        [email.trim(), activeYear]
      );
      if (checkEmail.rows.length > 0) {
        throw new Error(`Email '${email}' already exists for convocation year ${activeYear}.`);
      }

      // Check if seating allocation has already run for this faculty/group
      // If yes, this student should be marked as is_late_addition = TRUE
      const degTypeRes = await client.query("SELECT type FROM degrees WHERE id = $1", [degree_id]);
      const degType = degTypeRes.rows[0]?.type || 'Internal';
      const groupName = degType === 'External' ? 'All External Degrees' : `${faculty} (Internal)`;

      let isLate = false;
      if (degType === 'External') {
        const seatingCheck = await client.query(
          `SELECT 1 FROM students s
           JOIN degrees d ON s.degree_id = d.id
           WHERE d.type = 'External' AND s.seat_number IS NOT NULL AND s.convocation_year = $1 LIMIT 1`,
          [activeYear]
        );
        isLate = seatingCheck.rows.length > 0;
      } else {
        const seatingCheck = await client.query(
          `SELECT 1 FROM students WHERE faculty = $1 AND seat_number IS NOT NULL AND convocation_year = $2 LIMIT 1`,
          [faculty, activeYear]
        );
        isLate = seatingCheck.rows.length > 0;
      }

      // Find session date for matched group
      const sessRes = await client.query(
        "SELECT session_date FROM convocation_sessions WHERE faculty_1 = $1 OR faculty_2 = $1 LIMIT 1",
        [groupName]
      );
      const graduationDate = sessRes.rows[0]?.session_date || null;

      const dbGpa = gpa === '-' || gpa === null || gpa === undefined || gpa === '' ? null : parseFloat(gpa);
      const dbIndexNo = index_no === '-' || index_no === '' ? null : index_no;

      const magicToken = signMagicToken(email, registration_no, activeYear);

      const res = await client.query(
        `INSERT INTO students (
           name_with_initials, full_name, registration_no, index_no, nic_no, 
           faculty, degree_id, address, contact_no, email, gpa, class, 
           magic_token, convocation_year, effective_date, graduation_date, is_late_addition
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::date, $16::date, $17)
         RETURNING *`,
        [
          name_with_initials.trim(),
          full_name.trim(),
          registration_no.trim(),
          dbIndexNo?.trim() || null,
          nic_no.trim(),
          faculty.trim(),
          degree_id,
          address.trim(),
          contact_no.trim(),
          email.trim(),
          dbGpa,
          classVal.trim(),
          magicToken,
          activeYear,
          effective_date || null,
          graduationDate || null,
          isLate
        ]
      );

      const student = res.rows[0];

      // Log manually added student
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken, student_id)
         VALUES ($1, $2, $3)`,
        [session.username, `Manually added student: Reg No=${student.registration_no}, Name=${student.name_with_initials}`, student.id]
      );

      return student;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
