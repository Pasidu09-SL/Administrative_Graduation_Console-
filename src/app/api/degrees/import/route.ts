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

    // Instead of inserting, we now do a row-by-row mapping with validation errors.
    const results = rows.map((row: any, index: number) => {
      const rowNum = index + 2; // Assuming 1-based index plus header row
      const errors: Record<string, string> = {};

      let faculty = row.faculty?.trim();
      let degreeNo = parseInt(String(row.degree_no).trim(), 10);
      const nameEn = row.name_en?.trim();
      const nameSi = row.name_si?.trim();
      const nameTa = row.name_ta?.trim();
      let type = row.type?.trim();

      // Normalize Faculty name (case-insensitive)
      if (faculty) {
        const found = FACULTIES.find(f => f.toLowerCase() === faculty.toLowerCase());
        if (found) {
          faculty = found;
        }
      }

      // Normalize Type (case-insensitive)
      if (type) {
        const lower = type.toLowerCase();
        if (lower === 'internal') type = 'Internal';
        else if (lower === 'external') type = 'External';
      }

      if (!faculty) {
        errors.faculty = 'Faculty name is required.';
      } else if (!FACULTIES.includes(faculty)) {
        errors.faculty = `Invalid faculty name "${faculty}".`;
      }

      if (isNaN(degreeNo) || degreeNo <= 0) {
        errors.degree_no = 'F.No (Degree number) must be a positive integer.';
      }

      if (!nameEn) {
        errors.name_en = 'Degree title in English is required.';
      }

      if (!nameSi) {
        errors.name_si = 'Degree title in Sinhala is required.';
      }

      if (!nameTa) {
        errors.name_ta = 'Degree title in Tamil is required.';
      }

      if (!type) {
        errors.type = 'Degree type is required.';
      } else if (type !== 'Internal' && type !== 'External') {
        errors.type = 'Degree type must be "Internal" or "External".';
      }

      return {
        rowNumber: index + 1, // data row index starting at 1
        data: {
          faculty: row.faculty,
          degree_no: row.degree_no,
          name_en: row.name_en,
          name_si: row.name_si,
          name_ta: row.name_ta,
          type: row.type
        },
        errors,
        isValid: Object.keys(errors).length === 0
      };
    });

    const isValidBatch = results.every((r) => r.isValid);

    return NextResponse.json({ success: true, results, isValidBatch });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
