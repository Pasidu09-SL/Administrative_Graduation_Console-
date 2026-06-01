import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';

export async function GET() {
  try {
    const data = await runAsAdmin(async (client) => {
      const res = await client.query(`
        SELECT l.*, s.index_no, s.registration_no, s.email, s.name_with_initials
        FROM audit_logs l
        JOIN students s ON l.student_id = s.id
        ORDER BY l.timestamp DESC
      `);
      return res.rows;
    });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
