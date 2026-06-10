import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { timelineSchema } from '@/lib/validations';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const data = await runAsAdmin(async (client) => {
      const res = await client.query(
        'SELECT * FROM registration_windows ORDER BY id DESC LIMIT 1'
      );
      return res.rows[0] || null;
    });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = timelineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        errors: parsed.error.flatten().fieldErrors
      }, { status: 400 });
    }

    const { open_date, close_date, is_manually_closed = false } = parsed.data;

    const data = await runAsAdmin(async (client) => {
      // Get the previous window configuration to determine action type
      const prevRes = await client.query('SELECT * FROM registration_windows ORDER BY id DESC LIMIT 1');
      const prev = prevRes.rows[0];

      const res = await client.query(
        `INSERT INTO registration_windows (open_date, close_date, is_manually_closed)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [new Date(open_date), new Date(close_date), is_manually_closed]
      );
      const newConfig = res.rows[0];

      // Audit logs tracking details
      let actionText = '';
      if (!prev) {
        actionText = `Saved timeline configuration: Open = ${new Date(open_date).toLocaleString()}, Close = ${new Date(close_date).toLocaleString()}`;
      } else {
        const prevOpen = new Date(prev.open_date).getTime();
        const prevClose = new Date(prev.close_date).getTime();
        const newOpen = new Date(open_date).getTime();
        const newClose = new Date(close_date).getTime();

        if (prevOpen !== newOpen || prevClose !== newClose) {
          actionText = `Saved timeline configuration: Open = ${new Date(open_date).toLocaleString()}, Close = ${new Date(close_date).toLocaleString()}`;
        } else if (prev.is_manually_closed !== is_manually_closed) {
          actionText = is_manually_closed
            ? 'Emergency override activated: Portal closed manually'
            : 'Emergency override deactivated: Resumed timeline schedule';
        } else {
          actionText = `Saved timeline configuration: Open = ${new Date(open_date).toLocaleString()}, Close = ${new Date(close_date).toLocaleString()}`;
        }
      }

      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken, student_id)
         VALUES ($1, $2, NULL)`,
        [session.username, actionText]
      );

      return newConfig;
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
