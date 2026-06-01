import { NextResponse } from 'next/server';
import { runAsAdmin } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No data rows provided to commit.' }, { status: 400 });
    }

    const startTime = Date.now();

    await runAsAdmin(async (client) => {
      // Build batch insert query
      const values: any[] = [];
      const placeholders: string[] = [];
      let index = 1;

      for (const row of rows) {
        const {
          name_with_initials,
          full_name,
          registration_no,
          index_no,
          faculty,
          degreeId,
          address,
          contact_no,
          email,
          gpa,
          class: classVal,
        } = row;

        placeholders.push(
          `($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, $${index + 10})`
        );

        values.push(
          name_with_initials,
          full_name,
          registration_no,
          index_no,
          faculty,
          degreeId,
          address,
          contact_no,
          email,
          parseFloat(gpa),
          classVal
        );
        
        index += 11;
      }

      const query = `
        INSERT INTO students (
          name_with_initials, full_name, registration_no, index_no, faculty, degree_id, address, contact_no, email, gpa, class
        )
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (index_no) DO UPDATE SET
          registration_no = EXCLUDED.registration_no,
          email = EXCLUDED.email,
          name_with_initials = EXCLUDED.name_with_initials,
          full_name = EXCLUDED.full_name,
          faculty = EXCLUDED.faculty,
          degree_id = EXCLUDED.degree_id,
          address = EXCLUDED.address,
          contact_no = EXCLUDED.contact_no,
          gpa = EXCLUDED.gpa,
          class = EXCLUDED.class,
          updated_at = CURRENT_TIMESTAMP
      `;

      await client.query(query, values);
    });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      count: rows.length,
      durationMs,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
