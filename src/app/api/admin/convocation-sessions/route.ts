import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

// Helper: build the graduation_date sync query
const syncGraduationDatesQuery = `
  UPDATE students s
  SET graduation_date = (
    SELECT cs.session_date::DATE
    FROM convocation_sessions cs
    WHERE (
      (cs.faculty_1 = s.faculty || ' (Internal)' OR cs.faculty_2 = s.faculty || ' (Internal)')
      AND (s.degree_id IS NULL OR s.degree_id IN (SELECT id FROM degrees WHERE type = 'Internal' OR type IS NULL))
    ) OR (
      (cs.faculty_1 = 'All External Degrees' OR cs.faculty_2 = 'All External Degrees')
      AND s.degree_id IN (SELECT id FROM degrees WHERE type = 'External')
    )
    LIMIT 1
  )
  WHERE s.convocation_year = $1
`;

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

        // Sync graduation dates for matching students
        const activeYearRes = await client.query(
          "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
        );
        const activeYear = activeYearRes.rows[0]?.convocation_year || "2026";
        await client.query(syncGraduationDatesQuery, [activeYear]);

        // Audit Log
        await client.query(
          `INSERT INTO audit_logs (admin_id, action_taken)
           VALUES ($1, $2)`,
          [session.username, `Allocated group '${groupName}' to Session ${sessNum}`]
        );

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

        // Sync graduation dates
        const activeYearRes = await client.query(
          "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
        );
        const activeYear = activeYearRes.rows[0]?.convocation_year || "2026";
        await client.query(syncGraduationDatesQuery, [activeYear]);

        // Audit Log
        await client.query(
          `INSERT INTO audit_logs (admin_id, action_taken)
           VALUES ($1, $2)`,
          [session.username, `Cleared session allocation for group '${groupName}'`]
        );
      });

      return NextResponse.json({ success: true, message: `Cleared session allocation for ${groupName}.` });
    }

    if (action === "clear_all_allocations") {
      await runAsAdmin(async (client) => {
        await client.query(`
          UPDATE convocation_sessions 
          SET faculty_1 = NULL, faculty_2 = NULL
        `);

        // Sync graduation dates (all will become NULL since no sessions are mapped)
        const activeYearRes = await client.query(
          "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
        );
        const activeYear = activeYearRes.rows[0]?.convocation_year || "2026";
        await client.query(
          "UPDATE students SET graduation_date = NULL WHERE convocation_year = $1",
          [activeYear]
        );

        // Audit Log
        await client.query(
          `INSERT INTO audit_logs (admin_id, action_taken)
           VALUES ($1, $2)`,
          [session.username, `Cleared all group session allocations`]
        );
      });

      return NextResponse.json({ success: true, message: 'All session allocations cleared.' });
    }

    // Default: Add a new convocation session
    const { sessionNumber, sessionName } = body;
    const num = parseInt(sessionNumber);
    if (isNaN(num) || num <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid session number. Must be a positive integer.' }, { status: 400 });
    }

    const name = sessionName?.trim() || `Session ${num}`;

    const data = await runAsAdmin(async (client) => {
      // Check if student records exist to enforce lock
      const studentsCheck = await client.query('SELECT 1 FROM students LIMIT 1');
      if (studentsCheck.rows.length > 0) {
        throw new Error('Modifications are locked because student records exist in the database.');
      }

      // Check if session number already exists
      const checkRes = await client.query('SELECT 1 FROM convocation_sessions WHERE session_number = $1', [num]);
      if (checkRes.rows.length > 0) {
        throw new Error(`Session number ${num} already exists.`);
      }

      const res = await client.query(
        'INSERT INTO convocation_sessions (session_number, session_name) VALUES ($1, $2) RETURNING *',
        [num, name]
      );
      
      const newSess = res.rows[0];
      // Audit log
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken)
         VALUES ($1, $2)`,
        [session.username, `Added new convocation session: number=${num}, name='${name}'`]
      );
      return newSess;
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

// PATCH: Edit/rename convocation session details (supporting rename)
export async function PATCH(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrator role required.' }, { status: 401 });
    }

    const { id, sessionNumber, sessionName, sessionDate, sessionTime } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'Session ID is required.' }, { status: 400 });
    }

    const data = await runAsAdmin(async (client) => {
      // Check if student records exist to enforce lock
      const studentsCheck = await client.query('SELECT 1 FROM students LIMIT 1');
      if (studentsCheck.rows.length > 0) {
        throw new Error('Modifications are locked because student records exist in the database.');
      }

      // Check if session exists
      const sessCheck = await client.query('SELECT * FROM convocation_sessions WHERE id = $1', [id]);
      if (sessCheck.rows.length === 0) {
        throw new Error('Session not found.');
      }
      const original = sessCheck.rows[0];

      let updateQuery = `
        UPDATE convocation_sessions
        SET session_name = COALESCE($1, session_name),
            session_date = COALESCE($2, session_date),
            session_time = COALESCE($3, session_time)
      `;
      const params: any[] = [
        sessionName !== undefined ? sessionName.trim() : null, 
        sessionDate !== undefined ? sessionDate : null, 
        sessionTime !== undefined ? sessionTime : null
      ];

      if (sessionNumber !== undefined) {
        const num = parseInt(sessionNumber);
        if (isNaN(num) || num <= 0) {
          throw new Error('Invalid session number. Must be a positive integer.');
        }
        // Check duplicate session number
        const duplicateCheck = await client.query(
          'SELECT 1 FROM convocation_sessions WHERE session_number = $1 AND id <> $2',
          [num, id]
        );
        if (duplicateCheck.rows.length > 0) {
          throw new Error(`Session number ${num} already exists.`);
        }
        updateQuery += `, session_number = $4`;
        params.push(num);
      }

      updateQuery += ` WHERE id = $${params.length + 1} RETURNING *`;
      params.push(id);

      const res = await client.query(updateQuery, params);
      const updatedSess = res.rows[0];

      // Sync graduation dates if date changed
      const activeYearRes = await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
      );
      const activeYear = activeYearRes.rows[0]?.convocation_year || "2026";
      await client.query(syncGraduationDatesQuery, [activeYear]);

      // Audit Log
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken)
         VALUES ($1, $2)`,
        [session.username, `Renamed/updated convocation session: ID=${id}, new details: session_number=${updatedSess.session_number}, session_name='${updatedSess.session_name}'`]
      );

      return updatedSess;
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
      // Check if student records exist to enforce lock
      const studentsCheck = await client.query('SELECT 1 FROM students LIMIT 1');
      if (studentsCheck.rows.length > 0) {
        throw new Error('Modifications are locked because student records exist in the database.');
      }

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

      // Sync graduation dates
      const activeYearRes = await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
      );
      const activeYear = activeYearRes.rows[0]?.convocation_year || "2026";
      await client.query(syncGraduationDatesQuery, [activeYear]);

      // Audit Log
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken)
         VALUES ($1, $2)`,
        [session.username, `Deleted convocation session number=${sNum}`]
      );
    });

    return NextResponse.json({ success: true, message: 'Session deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
