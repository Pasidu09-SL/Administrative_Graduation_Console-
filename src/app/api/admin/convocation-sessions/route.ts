import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

// GET: Fetch all convocation sessions
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const data = await runAsAdmin(async (client) => {
      const res = await client.query('SELECT * FROM convocation_sessions ORDER BY session_number ASC');
      return res.rows;
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Add a new convocation session
// POST: Add or allocate a convocation session
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrator role required.' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "allocate") {
      const { groupName, sessionNumber, sessionDate, sessionTime } = body;
      const sessNum = parseInt(sessionNumber);
      if (isNaN(sessNum) || sessNum <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid session number.' }, { status: 400 });
      }
      if (!groupName) {
        return NextResponse.json({ success: false, error: 'Group name is required.' }, { status: 400 });
      }

      const data = await runAsAdmin(async (client) => {
        // 1. Find the target session
        const sessionRes = await client.query('SELECT * FROM convocation_sessions WHERE session_number = $1', [sessNum]);
        if (sessionRes.rows.length === 0) {
          throw new Error(`Session ${sessNum} does not exist.`);
        }
        const sessionRow = sessionRes.rows[0];

        // 2. Clear this group from any other session first
        await client.query(`
          UPDATE convocation_sessions 
          SET faculty_1 = CASE WHEN faculty_1 = $1 THEN NULL ELSE faculty_1 END,
              faculty_2 = CASE WHEN faculty_2 = $1 THEN NULL ELSE faculty_2 END
        `, [groupName]);

        // 3. Verify target session capacity (max 2 groups)
        const f1 = sessionRow.faculty_1;
        const f2 = sessionRow.faculty_2;

        let updateQuery = "";
        let params: any[] = [];

        if (f1 === groupName || f2 === groupName) {
          // Already in this session, just update date/time
          updateQuery = `
            UPDATE convocation_sessions 
            SET session_date = $1, session_time = $2 
            WHERE session_number = $3
            RETURNING *
          `;
          params = [sessionDate, sessionTime, sessNum];
        } else if (!f1) {
          updateQuery = `
            UPDATE convocation_sessions 
            SET session_date = $1, session_time = $2, faculty_1 = $3 
            WHERE session_number = $4
            RETURNING *
          `;
          params = [sessionDate, sessionTime, groupName, sessNum];
        } else if (!f2) {
          updateQuery = `
            UPDATE convocation_sessions 
            SET session_date = $1, session_time = $2, faculty_2 = $3 
            WHERE session_number = $4
            RETURNING *
          `;
          params = [sessionDate, sessionTime, groupName, sessNum];
        } else {
          throw new Error(`Session ${sessNum} is already full (occupied by: ${f1} and ${f2}).`);
        }

        const res = await client.query(updateQuery, params);
        return res.rows[0];
      });

      return NextResponse.json({ success: true, data });
    }

    if (action === "clear_allocation") {
      const { groupName } = body;
      if (!groupName) {
        return NextResponse.json({ success: false, error: 'Group name is required.' }, { status: 400 });
      }

      await runAsAdmin(async (client) => {
        await client.query(`
          UPDATE convocation_sessions 
          SET faculty_1 = CASE WHEN faculty_1 = $1 THEN NULL ELSE faculty_1 END,
              faculty_2 = CASE WHEN faculty_2 = $1 THEN NULL ELSE faculty_2 END
        `, [groupName]);
      });

      return NextResponse.json({ success: true, message: `Cleared session allocation for ${groupName}.` });
    }

    // Default: Add a new convocation session
    const { sessionNumber, sessionName } = body;
    const num = parseInt(sessionNumber);
    if (isNaN(num) || num <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid session number. Must be a positive integer.' }, { status: 400 });
    }

    const name = sessionName?.trim() || `Session ${num}`;

    const data = await runAsAdmin(async (client) => {
      // Check if session number already exists
      const checkRes = await client.query('SELECT 1 FROM convocation_sessions WHERE session_number = $1', [num]);
      if (checkRes.rows.length > 0) {
        throw new Error(`Session number ${num} already exists.`);
      }

      const res = await client.query(
        'INSERT INTO convocation_sessions (session_number, session_name) VALUES ($1, $2) RETURNING *',
        [num, name]
      );
      return res.rows[0];
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

// DELETE: Remove a convocation session
export async function DELETE(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrator role required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing session ID parameter.' }, { status: 400 });
    }

    await runAsAdmin(async (client) => {
      // Get session number
      const sRes = await client.query('SELECT session_number FROM convocation_sessions WHERE id = $1', [id]);
      if (sRes.rows.length === 0) {
        throw new Error('Session not found.');
      }
      const sNum = sRes.rows[0].session_number;

      // Check if any student is assigned to this session
      const studentRes = await client.query('SELECT 1 FROM students WHERE session_number = $1 LIMIT 1', [sNum]);
      if (studentRes.rows.length > 0) {
        throw new Error(`Cannot delete Session ${sNum} because active student seating allocations exist in it.`);
      }

      await client.query('DELETE FROM convocation_sessions WHERE id = $1', [id]);
    });

    return NextResponse.json({ success: true, message: 'Session deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
