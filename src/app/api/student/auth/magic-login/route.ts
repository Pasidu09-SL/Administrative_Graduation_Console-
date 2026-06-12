import { NextResponse } from 'next/server';
import { verifyMagicToken, isRegistrationWindowOpen } from '@/lib/auth';
import { runAsAdmin } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const emailParam = searchParams.get('email');
  const token = searchParams.get('token');

  if (!emailParam || !token) {
    return NextResponse.redirect(new URL('/?error=Missing%20email%20or%20verification%2520token', req.url));
  }

  try {
    // 1. Verify token signature and expiration
    const payload = verifyMagicToken(token);
    if (!payload) {
      return NextResponse.redirect(new URL('/?error=Invalid%20or%20expired%20magic%20link', req.url));
    }

    // Check registration window status
    const mockTime = req.headers.get('x-mock-time');
    const { isOpen } = await isRegistrationWindowOpen(mockTime);
    if (!isOpen) {
      const hasBypass = await runAsAdmin(async (client) => {
        const activeYearRes = await client.query(
          "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
        );
        const activeYear = activeYearRes.rows[0]?.convocation_year || '2026';
        const res = await client.query(
          'SELECT timeline_bypass FROM students WHERE LOWER(email) = LOWER($1) AND convocation_year = $2',
          [payload.email, activeYear]
        );
        return res.rows[0]?.timeline_bypass === true;
      });

      if (!hasBypass) {
        return NextResponse.redirect(new URL('/?error=Portal%20Closed', req.url));
      }
    }

    // 2. Ensure the email parameter matches the token payload (prevent token reuse for other accounts)
    if (payload.email.toLowerCase().trim() !== emailParam.toLowerCase().trim()) {
      return NextResponse.redirect(new URL('/?error=Token%20email%20mismatch', req.url));
    }

    // 3. Redirect to the login screen with email and token prefilled, requiring NIC and Index verification
    return NextResponse.redirect(new URL(`/?email=${encodeURIComponent(emailParam.toLowerCase().trim())}&token=${encodeURIComponent(token)}`, req.url));
  } catch (err: any) {
    console.error('Magic login redirect error:', err.message);
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(err.message)}`, req.url));
  }
}
