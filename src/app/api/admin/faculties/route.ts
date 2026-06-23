import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

// GET: Fetch all faculties
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const data = await runAsAdmin(async (client) => {
      const res = await client.query('SELECT * FROM faculties ORDER BY name ASC');
      return res.rows;
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Add a new faculty
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrator role required.' }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Invalid or empty faculty name provided.' }, { status: 400 });
    }

    const normalizedName = name.trim();

    const data = await runAsAdmin(async (client) => {
      // Check if student records exist to enforce lock
      const studentsCheck = await client.query('SELECT 1 FROM students LIMIT 1');
      if (studentsCheck.rows.length > 0) {
        throw new Error('Modifications are locked because student records exist in the database.');
      }

      // Check if already exists
      const checkRes = await client.query('SELECT 1 FROM faculties WHERE LOWER(name) = LOWER($1)', [normalizedName]);
      if (checkRes.rows.length > 0) {
        throw new Error(`Faculty '${normalizedName}' already exists.`);
      }

      const res = await client.query(
        'INSERT INTO faculties (name) VALUES ($1) RETURNING *',
        [normalizedName]
      );
      
      const newFaculty = res.rows[0];

      // Audit Log
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken)
         VALUES ($1, $2)`,
        [session.username, `Added new faculty/group: name='${normalizedName}'`]
      );

      return newFaculty;
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

// DELETE: Remove a faculty
export async function DELETE(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrator role required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing faculty ID parameter.' }, { status: 400 });
    }

    await runAsAdmin(async (client) => {
      // Check if student records exist to enforce lock
      const studentsCheck = await client.query('SELECT 1 FROM students LIMIT 1');
      if (studentsCheck.rows.length > 0) {
        throw new Error('Modifications are locked because student records exist in the database.');
      }

      // Get faculty name
      const facRes = await client.query('SELECT name FROM faculties WHERE id = $1', [id]);
      if (facRes.rows.length === 0) {
        throw new Error('Faculty not found.');
      }
      const facName = facRes.rows[0].name;

      // Check if faculty has registered degrees
      const degRes = await client.query('SELECT 1 FROM degrees WHERE faculty = $1 LIMIT 1', [facName]);
      if (degRes.rows.length > 0) {
        throw new Error(`Cannot delete '${facName}' because it has active degrees registered under it.`);
      }

      // Check if faculty has registered students
      const studRes = await client.query('SELECT 1 FROM students WHERE faculty = $1 LIMIT 1', [facName]);
      if (studRes.rows.length > 0) {
        throw new Error(`Cannot delete '${facName}' because it has active students registered under it.`);
      }

      await client.query('DELETE FROM faculties WHERE id = $1', [id]);

      // Audit Log
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken)
         VALUES ($1, $2)`,
        [session.username, `Deleted faculty/group: name='${facName}'`]
      );
    });

    return NextResponse.json({ success: true, message: 'Faculty deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

// PATCH: Rename a faculty
export async function PATCH(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrator role required.' }, { status: 401 });
    }

    const { id, name } = await req.json();
    if (!id || !name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Missing or invalid parameters.' }, { status: 400 });
    }

    const normalizedName = name.trim();

    const data = await runAsAdmin(async (client) => {
      // Check if student records exist to enforce lock
      const studentsCheck = await client.query('SELECT 1 FROM students LIMIT 1');
      if (studentsCheck.rows.length > 0) {
        throw new Error('Modifications are locked because student records exist in the database.');
      }

      // Check if faculty exists
      const facRes = await client.query('SELECT name FROM faculties WHERE id = $1', [id]);
      if (facRes.rows.length === 0) {
        throw new Error('Faculty not found.');
      }
      const oldName = facRes.rows[0].name;

      // Check if new name already exists elsewhere
      const checkRes = await client.query('SELECT 1 FROM faculties WHERE LOWER(name) = LOWER($1) AND id <> $2', [normalizedName, id]);
      if (checkRes.rows.length > 0) {
        throw new Error(`Faculty '${normalizedName}' already exists.`);
      }

      // Update faculty name
      const res = await client.query(
        'UPDATE faculties SET name = $1 WHERE id = $2 RETURNING *',
        [normalizedName, id]
      );

      // Also cascade update the faculty name in degrees table
      await client.query(
        'UPDATE degrees SET faculty = $1 WHERE faculty = $2',
        [normalizedName, oldName]
      );

      // Audit Log
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken)
         VALUES ($1, $2)`,
        [session.username, `Renamed faculty/group from '${oldName}' to '${normalizedName}'`]
      );

      return res.rows[0];
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
