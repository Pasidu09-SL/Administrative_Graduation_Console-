import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { timelineSchema } from '@/lib/validations';

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
      const res = await client.query(
        `INSERT INTO registration_windows (open_date, close_date, is_manually_closed)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [new Date(open_date), new Date(close_date), is_manually_closed]
      );
      return res.rows[0];
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
