import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';
import { studentSchema } from '@/lib/validations';

export async function POST(req: Request) {
  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: 'Invalid input format. Expected a rows array.' }, { status: 400 });
    }

    // Load all degrees for validation check
    const degrees = await runAsAdmin(async (client) => {
      const res = await client.query('SELECT id, code, name_en FROM degrees');
      return res.rows;
    });

    const degreeMap = new Map<string, string>();
    for (const d of degrees) {
      degreeMap.set(d.code.toLowerCase().trim(), d.id);
      degreeMap.set(d.name_en.toLowerCase().trim(), d.id);
    }

    const results = rows.map((row: any, index: number) => {
      // Normalize values before safeParse
      const normalizedRow = {
        ...row,
        gpa: row.gpa !== undefined && row.gpa !== null ? String(row.gpa) : undefined,
      };

      const parsed = studentSchema.safeParse(normalizedRow);
      const errors: Record<string, string> = {};

      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        for (const [key, val] of Object.entries(fieldErrors)) {
          if (val) errors[key] = val[0];
        }
      }

      // Check if degree code/name exists in database
      const degreeNameVal = String(row.degree_name || '').trim().toLowerCase();
      const degreeId = degreeMap.get(degreeNameVal);
      if (!degreeId) {
        errors.degree_name = `Degree Name or Code "${row.degree_name || ''}" not found in system.`;
      }

      return {
        rowNumber: index + 1,
        data: row,
        errors,
        isValid: Object.keys(errors).length === 0,
        degreeId: degreeId || null
      };
    });

    const isValidBatch = results.every((r) => r.isValid);

    return NextResponse.json({ success: true, results, isValidBatch });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
