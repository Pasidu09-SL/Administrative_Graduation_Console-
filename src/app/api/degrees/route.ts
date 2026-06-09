import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { degreeSchema } from '@/lib/validations';
import { getAdminSession } from '@/lib/auth';

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

    // Auto-calculate degree_no if not provided
    if (body.degree_no === undefined || body.degree_no === null || body.degree_no === '') {
      const nextDegreeNo = await runAsAdmin(async (client) => {
        const res = await client.query(
          'SELECT COALESCE(MAX(degree_no), 0) as max_no FROM degrees WHERE faculty = $1',
          [body.faculty]
        );
        return (res.rows[0]?.max_no || 0) + 1;
      });
      body.degree_no = nextDegreeNo;
    }

    // Auto-generate code if not provided
    if (!body.code) {
      const abbreviations: Record<string, string> = {
        'Faculty of Technology': 'FT',
        'Faculty of Applied Science': 'FAS',
        'Faculty of Management Studies': 'FMS',
        'Faculty of Social Science and Humanities': 'FSSH',
        'Faculty of Agriculture': 'FA',
        'Faculty of Medicine and Allied Science': 'FMAS',
      };
      const prefix = abbreviations[body.faculty] || body.faculty?.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'DEG';
      body.code = `${prefix}-DEG-${body.degree_no}`;
    }

    const parsed = degreeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        errors: parsed.error.flatten().fieldErrors
      }, { status: 400 });
    }

    const { code, faculty, degree_no, name_en, name_si, name_ta, type } = parsed.data;

    const data = await runAsAdmin(async (client) => {
      const res = await client.query(
        `INSERT INTO degrees (code, faculty, degree_no, name_en, name_si, name_ta, type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [code, faculty, degree_no, name_en, name_si, name_ta, type]
      );
      return res.rows[0];
    });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    if (err.code === '23505') {
      const isDegreeNo = err.message.includes('unique_faculty_degree_no');
      return NextResponse.json({
        success: false,
        error: isDegreeNo
          ? 'Degree number already exists for this faculty.'
          : 'Degree Code already exists.'
      }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, name_en, name_si, name_ta, type } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Degree ID is required' }, { status: 400 });
    }

    // Basic validations
    if (name_en !== undefined && name_en.trim() === '') {
      return NextResponse.json({ success: false, error: 'English name cannot be empty' }, { status: 400 });
    }
    if (name_si !== undefined && name_si.trim() === '') {
      return NextResponse.json({ success: false, error: 'Sinhala name cannot be empty' }, { status: 400 });
    }
    if (name_ta !== undefined && name_ta.trim() === '') {
      return NextResponse.json({ success: false, error: 'Tamil name cannot be empty' }, { status: 400 });
    }
    if (type !== undefined && type !== 'Internal' && type !== 'External') {
      return NextResponse.json({ success: false, error: 'Invalid Degree Type' }, { status: 400 });
    }

    const data = await runAsAdmin(async (client) => {
      const res = await client.query(
        `UPDATE degrees
         SET name_en = COALESCE($1, name_en),
             name_si = COALESCE($2, name_si),
             name_ta = COALESCE($3, name_ta),
             type = COALESCE($4, type),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [name_en, name_si, name_ta, type, id]
      );
      return res.rows[0];
    });

    if (!data) {
      return NextResponse.json({ success: false, error: 'Degree not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Degree ID is required' }, { status: 400 });
    }

    await runAsAdmin(async (client) => {
      await client.query('DELETE FROM degrees WHERE id = $1', [id]);
    });

    return NextResponse.json({ success: true, message: 'Degree deleted successfully.' });
  } catch (err: any) {
    if (err.code === '23503') {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete degree because it is associated with one or more students.'
      }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}


