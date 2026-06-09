import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const data = await runAsAdmin(async (client) => {
      // Get count of students assigned to each session grouped by faculty
      const res = await client.query(`
        SELECT faculty, session_number, COUNT(*) as student_count
        FROM students
        WHERE session_number IS NOT NULL AND verification_status = 'Approved'
        GROUP BY faculty, session_number
        ORDER BY session_number ASC, faculty ASC
      `);
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

    const { faculty, sessionNumber } = await req.json();

    if (!faculty || sessionNumber === undefined) {
      return NextResponse.json({ success: false, error: 'Faculty and sessionNumber are required.' }, { status: 400 });
    }

    const sessNum = parseInt(sessionNumber);
    if (sessNum < 1 || sessNum > 4) {
      return NextResponse.json({ success: false, error: 'Session number must be between 1 and 4.' }, { status: 400 });
    }

    const result = await runAsAdmin(async (client) => {
      // 1. Verify session limit: max 2 faculties per session, no split faculty.
      const facRes = await client.query(
        'SELECT DISTINCT faculty FROM students WHERE session_number = $1 AND faculty != $2',
        [sessNum, faculty]
      );
      
      const otherFacultiesInSession = facRes.rows.map(r => r.faculty);
      if (otherFacultiesInSession.length >= 2) {
        throw new Error(`Session ${sessNum} is already full (occupied by: ${otherFacultiesInSession.join(', ')}).`);
      }

      // 2. Reset seating details for this faculty (in case they are reassigned)
      await client.query(
        `UPDATE students
         SET session_number = NULL, seat_number = NULL, certificate_number = NULL
         WHERE faculty = $1`,
        [faculty]
      );

      // 3. Query maximum existing seat number in this session
      const maxSeatRes = await client.query(
        'SELECT COALESCE(MAX(seat_number), 0) as max_seat FROM students WHERE session_number = $1',
        [sessNum]
      );
      let nextSeat = parseInt(maxSeatRes.rows[0].max_seat) + 1;

      // 4. Fetch students of this faculty in alphabetical index number sequence who are approved and attending
      const studentsRes = await client.query(
        "SELECT id FROM students WHERE faculty = $1 AND verification_status = 'Approved' AND attending_convocation = TRUE ORDER BY index_no ASC",
        [faculty]
      );
      const studentIds = studentsRes.rows.map(r => r.id);

      const year = new Date().getFullYear().toString().slice(-2); // e.g. '26'
      
      // 5. Sequentially allocate seating and certificate numbers
      for (const id of studentIds) {
        const certNo = `${year}.${sessNum}.${nextSeat}`;
        await client.query(
          `UPDATE students
           SET session_number = $1, seat_number = $2, certificate_number = $3
           WHERE id = $4`,
          [sessNum, nextSeat, certNo, id]
        );
        nextSeat++;
      }

      return {
        faculty,
        sessionNumber: sessNum,
        allocatedCount: studentIds.length,
        startingSeat: parseInt(maxSeatRes.rows[0].max_seat) + 1,
        endingSeat: nextSeat - 1
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
