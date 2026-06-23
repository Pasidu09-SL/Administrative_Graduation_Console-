import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { logAuditAction } from '@/lib/db';

export async function POST() {
  const session = await getAdminSession();
  if (session) {
    await logAuditAction(session.username, `${session.role} logged out`);
  }
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.delete('admin_session');
  return response;
}
