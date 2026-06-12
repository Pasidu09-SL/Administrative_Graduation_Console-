import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { runAsAdmin } from '@/lib/db';
import { signAdminToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required.' },
        { status: 400 }
      );
    }

    // Hash the input password using SHA-256
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    // Query staff table
    const staffMember = await runAsAdmin(async (client) => {
      const res = await client.query(
        'SELECT * FROM staff WHERE LOWER(username) = LOWER($1)',
        [username.trim()]
      );
      return res.rows[0] || null;
    });

    if (!staffMember) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    if (staffMember.password_hash !== passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    if (staffMember.status === 'Disabled') {
      return NextResponse.json(
        { success: false, error: 'Account disabled. Please contact your administrator.' },
        { status: 403 }
      );
    }

    // Create session token
    const token = signAdminToken({
      username: staffMember.username,
      name: staffMember.name,
      role: staffMember.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        username: staffMember.username,
        name: staffMember.name,
        role: staffMember.role,
      },
    });

    // Set HTTP-only admin session cookie
    response.cookies.set({
      name: 'admin_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
