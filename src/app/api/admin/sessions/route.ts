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
      // Get count of students assigned to each session grouped by faculty and degree type
      const res = await client.query(`
        SELECT s.faculty, d.type as degree_type, s.session_number, COUNT(*) as student_count
        FROM students s
        LEFT JOIN degrees d ON s.degree_id = d.id
        WHERE s.session_number IS NOT NULL AND s.verification_status = 'Approved'
        GROUP BY s.faculty, d.type, s.session_number
        ORDER BY s.session_number ASC, s.faculty ASC
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

    const { faculty, group, sessionNumber } = await req.json();
    const targetGroup = group || faculty;

    if (!targetGroup || sessionNumber === undefined) {
      return NextResponse.json({ success: false, error: 'Group and sessionNumber are required.' }, { status: 400 });
    }

    const sessNum = parseInt(sessionNumber);
    if (sessNum < 1 || sessNum > 4) {
      return NextResponse.json({ success: false, error: 'Session number must be between 1 and 4.' }, { status: 400 });
    }

    const result = await runAsAdmin(async (client) => {
      // 1. Verify session limit: max 2 groups per session
      const assignedRes = await client.query(`
        SELECT DISTINCT s.faculty, d.type as degree_type
        FROM students s
        LEFT JOIN degrees d ON s.degree_id = d.id
        WHERE s.session_number = $1
      `, [sessNum]);

      const activeGroups = new Set<string>();
      for (const row of assignedRes.rows) {
        if (row.degree_type === 'External') {
          activeGroups.add('All External Degrees');
        } else {
          const facName = row.faculty;
          activeGroups.add(`${facName} (Internal)`);
        }
      }

      // If the targetGroup is already in the session, it is being reallocated, so remove it from current group count check
      activeGroups.delete(targetGroup);
      if (activeGroups.size >= 2) {
        throw new Error(`Session ${sessNum} is already full (occupied by: ${Array.from(activeGroups).join(', ')}).`);
      }

      // 2. Reset seating details for this group (in case they are reassigned)
      if (targetGroup === 'All External Degrees' || targetGroup === 'External') {
        await client.query(`
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          FROM degrees d
          WHERE s.degree_id = d.id AND d.type = 'External'
        `);
      } else if (targetGroup.endsWith(' (Internal)')) {
        const actualFaculty = targetGroup.replace(' (Internal)', '');
        await client.query(`
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          FROM degrees d
          WHERE s.degree_id = d.id AND s.faculty = $1 AND (d.type = 'Internal' OR d.type IS NULL)
        `, [actualFaculty]);
      } else {
        // Legacy fallback
        await client.query(`
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          WHERE s.faculty = $1
        `, [targetGroup]);
      }

      // 3. Query maximum existing seat number in this session
      const maxSeatRes = await client.query(
        'SELECT COALESCE(MAX(seat_number), 0) as max_seat FROM students WHERE session_number = $1',
        [sessNum]
      );
      let nextSeat = parseInt(maxSeatRes.rows[0].max_seat) + 1;

      // 4. Fetch students of this group
      let studentsRes;
      if (targetGroup === 'All External Degrees' || targetGroup === 'External') {
        studentsRes = await client.query(`
          SELECT s.id 
          FROM students s
          JOIN degrees d ON s.degree_id = d.id
          WHERE d.type = 'External' AND s.verification_status = 'Approved' AND s.attending_convocation = TRUE 
          ORDER BY s.index_no ASC
        `);
      } else if (targetGroup.endsWith(' (Internal)')) {
        const actualFaculty = targetGroup.replace(' (Internal)', '');
        studentsRes = await client.query(`
          SELECT s.id 
          FROM students s
          JOIN degrees d ON s.degree_id = d.id
          WHERE s.faculty = $1 AND (d.type = 'Internal' OR d.type IS NULL) AND s.verification_status = 'Approved' AND s.attending_convocation = TRUE 
          ORDER BY s.index_no ASC
        `, [actualFaculty]);
      } else {
        // Legacy fallback
        studentsRes = await client.query(`
          SELECT s.id 
          FROM students s
          WHERE s.faculty = $1 AND s.verification_status = 'Approved' AND s.attending_convocation = TRUE 
          ORDER BY s.index_no ASC
        `, [targetGroup]);
      }
      const studentIds = studentsRes.rows.map((r: any) => r.id);
      if (studentIds.length === 0) {
        throw new Error(`No approved candidates attending convocation found for group: ${targetGroup}`);
      }

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
        faculty: targetGroup,
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

export async function DELETE(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const group = searchParams.get('group');

    if (!group) {
      return NextResponse.json({ success: false, error: 'Group parameter is required.' }, { status: 400 });
    }

    await runAsAdmin(async (client) => {
      if (group === 'All External Degrees' || group === 'External') {
        await client.query(`
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          FROM degrees d
          WHERE s.degree_id = d.id AND d.type = 'External'
        `);
      } else if (group.endsWith(' (Internal)')) {
        const actualFaculty = group.replace(' (Internal)', '');
        await client.query(`
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          FROM degrees d
          WHERE s.degree_id = d.id AND s.faculty = $1 AND (d.type = 'Internal' OR d.type IS NULL)
        `, [actualFaculty]);
      } else {
        // Legacy fallback
        await client.query(`
          UPDATE students s
          SET session_number = NULL, seat_number = NULL, certificate_number = NULL
          WHERE s.faculty = $1
        `, [group]);
      }
    });

    return NextResponse.json({ success: true, message: `Successfully cleared session and seating allocation for ${group}.` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

