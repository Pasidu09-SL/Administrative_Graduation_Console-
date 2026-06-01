import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { isRegistrationWindowOpen, signToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, index_no, code } = await req.json();
    if (!email || !index_no || !code) {
      return NextResponse.json({ success: false, error: 'Email, Index Number, and OTP Code are required.' }, { status: 400 });
    }

    // Check registration window status
    const mockTime = req.headers.get('x-mock-time');
    const { isOpen } = await isRegistrationWindowOpen(mockTime);
    if (!isOpen) {
      return NextResponse.json({ success: false, error: 'Portal Closed', code: 'PORTAL_CLOSED' }, { status: 403 });
    }

    const matchedOtp = await runAsAdmin(async (client) => {
      const res = await client.query(
        'SELECT code, expires_at FROM otp_codes WHERE LOWER(email) = LOWER($1)',
        [email.trim()]
      );
      return res.rows[0] || null;
    });

    if (!matchedOtp) {
      return NextResponse.json({ success: false, error: 'OTP request not found.' }, { status: 400 });
    }

    // Check expiration (ignore expiration constraint during boundary mocking if mockTime is active, or use checkTime)
    const checkTime = mockTime ? new Date(mockTime) : new Date();
    if (checkTime > new Date(matchedOtp.expires_at)) {
      return NextResponse.json({ success: false, error: 'OTP has expired.' }, { status: 400 });
    }

    if (matchedOtp.code !== code.trim()) {
      return NextResponse.json({ success: false, error: 'Invalid OTP code.' }, { status: 401 });
    }

    // Clean up OTP code from DB upon success
    await runAsAdmin(async (client) => {
      await client.query('DELETE FROM otp_codes WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    });

    // Create session token
    const token = signToken({ email: email.toLowerCase().trim(), index_no: index_no.trim() });

    const response = NextResponse.json({ success: true, message: 'OTP verified successfully.' });
    
    // Set HTTP-only cookie
    response.cookies.set({
      name: 'student_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
