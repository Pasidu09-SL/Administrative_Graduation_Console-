import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { isRegistrationWindowOpen } from '@/lib/auth';
import { sendEmail, getOtpTemplate, getTemplateData } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { email, registration_no } = await req.json();
    if (!email || !registration_no) {
      return NextResponse.json({ success: false, error: 'Email and Registration Number are required.' }, { status: 400 });
    }

    // Verify student details (case-insensitive for email, strict for registration number)
    const student = await runAsAdmin(async (client) => {
      const activeYearRes = await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
      );
      const activeYear = activeYearRes.rows[0]?.convocation_year || '2026';
      const res = await client.query(
        'SELECT id, timeline_bypass FROM students WHERE LOWER(email) = LOWER($1) AND registration_no = $2 AND convocation_year = $3',
        [email.trim(), registration_no.trim(), activeYear]
      );
      return res.rows[0] || null;
    });

    if (!student) {
      return NextResponse.json({ success: false, error: 'Student record not found or registration number mismatch.' }, { status: 401 });
    }

    // Check registration window status
    const mockTime = req.headers.get('x-mock-time');
    const { isOpen } = await isRegistrationWindowOpen(mockTime);
    if (!isOpen && !student.timeline_bypass) {
      return NextResponse.json({ success: false, error: 'Portal Closed', code: 'PORTAL_CLOSED' }, { status: 403 });
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

    // Dispatch verification OTP email
    const otpBody = await getOtpTemplate(otp);
    const templateData = await getTemplateData('otp');
    let finalSubject = templateData.subject || 'Verification Code';
    if (finalSubject.includes('{{otp_code}}')) {
      finalSubject = finalSubject.replace(/\{\{otp_code\}\}/g, otp);
    } else {
      finalSubject = `${otp} is your ${finalSubject}`;
    }

    await sendEmail({
      to: [{ email: email.toLowerCase().trim() }],
      subject: finalSubject,
      htmlContent: otpBody
    });

    return NextResponse.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
