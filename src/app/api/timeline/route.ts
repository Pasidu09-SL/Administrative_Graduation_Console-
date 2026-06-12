import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { timelineSchema } from '@/lib/validations';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const data = await runAsAdmin(async (client) => {
      const res = await client.query(
        'SELECT * FROM registration_windows WHERE is_active = TRUE LIMIT 1'
      );
      if (res.rows.length > 0) return res.rows[0];
      const fallback = await client.query(
        'SELECT * FROM registration_windows ORDER BY id DESC LIMIT 1'
      );
      return fallback.rows[0] || null;
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
      // Get the active window configuration or latest fallback to determine action type
      const prevRes = await client.query(
        'SELECT * FROM registration_windows WHERE is_active = TRUE LIMIT 1'
      );
      let prev = prevRes.rows[0];
      if (!prev) {
        const fallback = await client.query('SELECT * FROM registration_windows ORDER BY id DESC LIMIT 1');
        prev = fallback.rows[0];
      }

      const activeYear = prev?.convocation_year || '2026';

      // Insert or update for activeYear (or upsert on convocation_year)
      const res = await client.query(
        `INSERT INTO registration_windows (convocation_year, open_date, close_date, is_manually_closed, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (convocation_year) 
         DO UPDATE SET 
           open_date = EXCLUDED.open_date,
           close_date = EXCLUDED.close_date,
           is_manually_closed = EXCLUDED.is_manually_closed,
           is_active = TRUE
         RETURNING *`,
        [activeYear, new Date(open_date), new Date(close_date), is_manually_closed]
      );
      const newConfig = res.rows[0];

      // Audit logs tracking details
      let actionText = '';
      if (!prev) {
        actionText = `Saved timeline configuration for year ${activeYear}: Open = ${new Date(open_date).toLocaleString()}, Close = ${new Date(close_date).toLocaleString()}`;
      } else {
        const prevOpen = new Date(prev.open_date).getTime();
        const prevClose = new Date(prev.close_date).getTime();
        const newOpen = new Date(open_date).getTime();
        const newClose = new Date(close_date).getTime();

        if (prevOpen !== newOpen || prevClose !== newClose) {
          actionText = `Saved timeline configuration for year ${activeYear}: Open = ${new Date(open_date).toLocaleString()}, Close = ${new Date(close_date).toLocaleString()}`;
        } else if (prev.is_manually_closed !== is_manually_closed) {
          actionText = is_manually_closed
            ? `Emergency override activated: Portal closed manually for year ${activeYear}`
            : `Emergency override deactivated: Resumed timeline schedule for year ${activeYear}`;
        } else {
          actionText = `Saved timeline configuration for year ${activeYear}: Open = ${new Date(open_date).toLocaleString()}, Close = ${new Date(close_date).toLocaleString()}`;
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
