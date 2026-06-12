import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

// GET: Fetch all staff accounts
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Forbidden: Only Administrators can access staff details.' }, { status: 403 });
    }

    const data = await runAsAdmin(async (client) => {
      const res = await client.query(
        'SELECT id, username, name, role, status, created_at FROM staff ORDER BY username ASC'
      );
      return res.rows;
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Add a new staff account
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Forbidden: Only Administrators can create staff accounts.' }, { status: 403 });
    }

    const { username, password, name, role } = await req.json();

    if (!username || !password || !name || !role) {
      return NextResponse.json({ success: false, error: 'All fields (username, password, name, role) are required.' }, { status: 400 });
    }

    if (role !== 'Staff' && role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Invalid role. Must be either Staff or Administrator.' }, { status: 400 });
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    const data = await runAsAdmin(async (client) => {
      const res = await client.query(
        `INSERT INTO staff (username, password_hash, name, role, status)
         VALUES ($1, $2, $3, $4, 'Active')
         RETURNING id, username, name, role, status, created_at`,
        [username.trim().toLowerCase(), passwordHash, name.trim(), role]
      );
      return res.rows[0];
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    if (err.code === '23505') {
      return NextResponse.json({ success: false, error: 'Username already exists.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Toggle staff status between Active and Disabled
export async function PATCH(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Forbidden: Only Administrators can toggle staff status.' }, { status: 403 });
    }

    const { id, status } = await req.json();
    if (!id || !status || (status !== 'Active' && status !== 'Disabled')) {
      return NextResponse.json({ success: false, error: 'Invalid ID or status parameters.' }, { status: 400 });
    }

    const data = await runAsAdmin(async (client) => {
      // Fetch user username to verify self-lockout
      const userRes = await client.query('SELECT username FROM staff WHERE id = $1', [id]);
      if (userRes.rows.length === 0) {
        throw new Error('Staff user not found.');
      }

      const userUsername = userRes.rows[0].username;
      if (userUsername.toLowerCase() === session.username.toLowerCase() && status === 'Disabled') {
        throw new Error('Lockout protection: You cannot disable your own active administrator account.');
      }

      const res = await client.query(
        'UPDATE staff SET status = $1 WHERE id = $2 RETURNING id, username, name, role, status, created_at',
        [status, id]
      );
      return res.rows[0];
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

// DELETE: Delete a staff account
export async function DELETE(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Forbidden: Only Administrators can delete staff accounts.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing staff user ID parameter.' }, { status: 400 });
    }

    await runAsAdmin(async (client) => {
      const userRes = await client.query('SELECT username FROM staff WHERE id = $1', [id]);
      if (userRes.rows.length === 0) {
        throw new Error('Staff user not found.');
      }

      const userUsername = userRes.rows[0].username;
      if (userUsername.toLowerCase() === session.username.toLowerCase()) {
        throw new Error('Lockout protection: You cannot delete your own active administrator account.');
      }

      await client.query('DELETE FROM staff WHERE id = $1', [id]);
    });

    return NextResponse.json({ success: true, message: 'Staff account deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
