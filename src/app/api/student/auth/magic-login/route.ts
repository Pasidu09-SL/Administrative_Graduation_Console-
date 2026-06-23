import { NextResponse } from 'next/server';
import { verifyMagicToken, isRegistrationWindowOpen } from '@/lib/auth';
import { runAsAdmin } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const emailParam = searchParams.get('email');
  const token = searchParams.get('token');

  // 🔥 1. Define baseUrl at the top so ALL redirects use it
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://graduation-portal.duzb.me' 
    : (req.headers.get('x-forwarded-proto') + '://' + req.headers.get('host') || 'http://localhost:3001');

  if (!emailParam || !token) {
    // 💡 Changed req.url to baseUrl
    return NextResponse.redirect(new URL('/?error=Missing%20email%20or%20verification%2520token', baseUrl));
  }

  try {
    // 1. Verify token signature and expiration
    const payload = verifyMagicToken(token);
    if (!payload) {
      // 💡 Changed req.url to baseUrl
      return NextResponse.redirect(new URL('/?error=Invalid%20or%20expired%20magic%20link', baseUrl));
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
        // 💡 Changed req.url to baseUrl
        return NextResponse.redirect(new URL('/?error=Portal%20Closed', baseUrl));
      }
    }

    // 2. Ensure the email parameter matches the token payload
    if (payload.email.toLowerCase().trim() !== emailParam.toLowerCase().trim()) {
      // 💡 Changed req.url to baseUrl
      return NextResponse.redirect(new URL('/?error=Token%20email%20mismatch', baseUrl));
    }

    // 3. Redirect to the login screen with email and token prefilled
    return NextResponse.redirect(new URL(`/?email=${encodeURIComponent(emailParam.toLowerCase().trim())}&token=${encodeURIComponent(token)}`, baseUrl));
  } catch (err: any) {
    console.error('Magic login redirect error:', err.message);
    // 💡 Changed req.url to baseUrl
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(err.message)}`, baseUrl));
  }
}