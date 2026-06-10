import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== 'Administrator') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const backupData = await runAsAdmin(async (client) => {
      const degreesRes = await client.query('SELECT * FROM degrees');
      const studentsRes = await client.query('SELECT * FROM students');
      const staffRes = await client.query('SELECT * FROM staff');
      const auditLogsRes = await client.query('SELECT * FROM audit_logs');
      const timelineRes = await client.query('SELECT * FROM registration_windows');

      return {
        timestamp: new Date().toISOString(),
        version: '1.0',
        degrees: degreesRes.rows,
        students: studentsRes.rows,
        staff: staffRes.rows,
        audit_logs: auditLogsRes.rows,
        registration_windows: timelineRes.rows,
      };
    });

    const filename = `rusl_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.json`;

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
