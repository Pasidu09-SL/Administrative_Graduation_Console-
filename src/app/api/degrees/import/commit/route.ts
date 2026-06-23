import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

const FACULTIES = [
  'Faculty of Technology',
  'Faculty of Applied Sciences',
  'Faculty of Management Studies',
  'Faculty of Social Sciences & Humanities',
  'Faculty of Agriculture',
  'Faculty of Medicine and Allied Sciences'
];

const abbreviations: Record<string, string> = {
  'Faculty of Technology': 'FT',
  'Faculty of Applied Sciences': 'FAS',
  'Faculty of Management Studies': 'FMS',
  'Faculty of Social Sciences & Humanities': 'FSSH',
  'Faculty of Agriculture': 'FA',
  'Faculty of Medicine and Allied Sciences': 'FMAS',
};

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { rows } = await req.json();
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: 'Invalid or missing degrees rows array.' }, { status: 400 });
    }

    const importedDegrees: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let faculty = row.faculty?.trim();
      let degreeNo = parseInt(String(row.degree_no).trim(), 10);
      const nameEn = row.name_en?.trim();
      const nameSi = row.name_si?.trim();
      const nameTa = row.name_ta?.trim();
      let type = row.type?.trim();

      // Normalize Faculty
      if (faculty) {
        const found = FACULTIES.find(f => f.toLowerCase() === faculty.toLowerCase());
        if (found) faculty = found;
      }

      // Normalize Type
      if (type) {
        const lower = type.toLowerCase();
        if (lower === 'internal') type = 'Internal';
        else if (lower === 'external') type = 'External';
      }

      const prefix = abbreviations[faculty] || 'DEG';
      const code = `${prefix}-DEG-${degreeNo}`;

      importedDegrees.push({
        code,
        faculty,
        degree_no: degreeNo,
        name_en: nameEn,
        name_si: nameSi,
        name_ta: nameTa,
        type
      });
    }

    if (importedDegrees.length === 0) {
      return NextResponse.json({ success: false, error: 'No degrees found to commit.' }, { status: 400 });
    }

    // Insert or update on conflict (faculty, degree_no)
    const result = await runAsAdmin(async (client) => {
      const maxRes = await client.query('SELECT COALESCE(MAX(import_order), 0) as max_order FROM degrees');
      let currentOrder = parseInt(maxRes.rows[0].max_order, 10);

      const inserted: any[] = [];
      for (const d of importedDegrees) {
        currentOrder++;
        const res = await client.query(`
          INSERT INTO degrees (code, faculty, degree_no, name_en, name_si, name_ta, type, import_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (faculty, degree_no) 
          DO UPDATE SET 
            code = EXCLUDED.code,
            name_en = EXCLUDED.name_en,
            name_si = EXCLUDED.name_si,
            name_ta = EXCLUDED.name_ta,
            type = EXCLUDED.type,
            import_order = EXCLUDED.import_order,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `, [d.code, d.faculty, d.degree_no, d.name_en, d.name_si, d.name_ta, d.type, currentOrder]);
        
        inserted.push(res.rows[0]);
      }
      // Write audit log
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken)
         VALUES ($1, $2)`,
        [session.username, `Bulk imported ${inserted.length} degrees via Excel`]
      );

      return inserted;
    });

    return NextResponse.json({ success: true, count: result.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
