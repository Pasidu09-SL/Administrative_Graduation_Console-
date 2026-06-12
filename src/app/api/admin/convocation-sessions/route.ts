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
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrator role required.' }, { status: 401 });
    }

    const { sessionNumber, sessionName } = await req.json();
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
