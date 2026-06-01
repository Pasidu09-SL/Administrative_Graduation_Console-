import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { degreeSchema } from '@/lib/validations';

export async function GET() {
  try {
    const data = await runAsAdmin(async (client) => {
      const res = await client.query('SELECT * FROM degrees ORDER BY name_en ASC');
      return res.rows;
    });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = degreeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        errors: parsed.error.flatten().fieldErrors
      }, { status: 400 });
    }

    const { code, name_en, name_si, name_ta, type } = parsed.data;

    const data = await runAsAdmin(async (client) => {
      const res = await client.query(
        `INSERT INTO degrees (code, name_en, name_si, name_ta, type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [code, name_en, name_si, name_ta, type]
      );
      return res.rows[0];
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    if (err.code === '23505') {
      return NextResponse.json({
        success: false,
        error: 'Degree Code already exists'
      }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
