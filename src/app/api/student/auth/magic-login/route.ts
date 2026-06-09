import { NextResponse } from 'next/server';
import { verifyMagicToken } from '@/lib/auth';

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
