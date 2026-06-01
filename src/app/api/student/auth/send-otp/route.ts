import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { isRegistrationWindowOpen } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, index_no } = await req.json();
    if (!email || !index_no) {
      return NextResponse.json({ success: false, error: 'Email and Index Number are required.' }, { status: 400 });
    }

    // Check registration window status
    const mockTime = req.headers.get('x-mock-time');
    const { isOpen } = await isRegistrationWindowOpen(mockTime);
    if (!isOpen) {
      return NextResponse.json({ success: false, error: 'Portal Closed', code: 'PORTAL_CLOSED' }, { status: 403 });
    }

    // Verify student details (case-insensitive for email, strict for index number)
    const student = await runAsAdmin(async (client) => {
      const res = await client.query(
        'SELECT id FROM students WHERE LOWER(email) = LOWER($1) AND index_no = $2',
        [email.trim(), index_no.trim()]
      );
      return res.rows[0] || null;
    });

    if (!student) {
      return NextResponse.json({ success: false, error: 'Student record not found or index mismatch.' }, { status: 401 });
    }

    // Generate secure 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    await runAsAdmin(async (client) => {
      await client.query(
        `INSERT INTO otp_codes (email, code, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET
           code = EXCLUDED.code,
           expires_at = EXCLUDED.expires_at,
           created_at = CURRENT_TIMESTAMP`,
        [email.toLowerCase().trim(), otp, expiresAt]
      );
    });

    // Output OTP in system logs for local testing
    console.log(`[MOCK EMAIL SERVICE] OTP for student ${email} is ${otp}`);

    return NextResponse.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
