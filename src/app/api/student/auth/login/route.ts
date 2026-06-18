import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { isRegistrationWindowOpen, signToken, verifyMagicToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, registration_no, nic_no, token } = await req.json();
    if (!email || !registration_no || !nic_no || !token) {
      return NextResponse.json({ success: false, error: 'Email, Registration Number, NIC Number, and Verification Token are required.' }, { status: 400 });
    }

    // Verify magic token signature and expiration
    const payload = verifyMagicToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Your registration link is invalid or has expired. Please request a new link from the Exam Division.' }, { status: 401 });
    }

    // Ensure the token's email and registration number match the login input
    if (payload.email.toLowerCase().trim() !== email.toLowerCase().trim() ||
        payload.registration_no.trim() !== registration_no.trim()) {
      return NextResponse.json({ success: false, error: 'Token credentials mismatch. Please use the unique link sent to your email.' }, { status: 401 });
    }

    // Verify student details (case-insensitive for email, strict for registration number and NIC)
    const student = await runAsAdmin(async (client) => {
      const activeYearRes = await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
      );
      const activeYear = activeYearRes.rows[0]?.convocation_year || '2026';
      const targetYear = payload.convocation_year || activeYear;
      const res = await client.query(
        'SELECT email, registration_no, index_no, nic_no, convocation_year, timeline_bypass FROM students WHERE LOWER(email) = LOWER($1) AND registration_no = $2 AND nic_no = $3 AND convocation_year = $4',
        [email.trim(), registration_no.trim(), nic_no.trim(), targetYear]
      );
      return res.rows[0] || null;
    });

    if (!student) {
      return NextResponse.json({ success: false, error: 'Student record not found or credential mismatch.' }, { status: 401 });
    }

    // Check registration window status
    const mockTime = req.headers.get('x-mock-time');
    const { isOpen } = await isRegistrationWindowOpen(mockTime);
    if (!isOpen && !student.timeline_bypass) {
      return NextResponse.json({ success: false, error: 'Portal Closed', code: 'PORTAL_CLOSED' }, { status: 403 });
    }

    // Create session token with remaining magic link lifetime
    const sessionToken = signToken({
      email: student.email.toLowerCase().trim(),
      registration_no: student.registration_no.trim(),
      convocation_year: student.convocation_year,
      magicTokenExp: payload.exp
    });

    const response = NextResponse.json({ success: true, message: 'Authentication successful.' });
    
    // Set HTTP-only cookie to expire when the magic token expires
    const maxAge = Math.max(0, Math.floor((payload.exp - Date.now()) / 1000));
    response.cookies.set({
      name: 'student_session',
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge,
      path: '/'
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
