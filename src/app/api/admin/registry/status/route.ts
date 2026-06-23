import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const hasStudents = await runAsAdmin(async (client) => {
      const res = await client.query('SELECT 1 FROM students LIMIT 1');
      return res.rows.length > 0;
    });

    return NextResponse.json({ success: true, hasStudents });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
