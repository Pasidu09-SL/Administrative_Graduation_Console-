import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

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
        'SELECT id, username, name, role, created_at FROM staff ORDER BY username ASC'
      );
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
        `INSERT INTO staff (username, password_hash, name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, name, role, created_at`,
        [username.trim(), passwordHash, name.trim(), role]
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
