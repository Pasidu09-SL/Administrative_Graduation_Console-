import { NextResponse } from 'next/server';
import { runAsAdmin, logAuditAction } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'system';
    const faculty = searchParams.get('faculty');
    const degreeId = searchParams.get('degreeId');

    const activeYearRes = await runAsAdmin(async (client) => {
      return await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
      );
    });
    const activeYear = activeYearRes.rows[0]?.convocation_year || '2026';

    const students = await runAsAdmin(async (client) => {
      const conditions: string[] = ['payment_slip_path IS NOT NULL', 'convocation_year = $1'];
      const values: any[] = [activeYear];
      let index = 2;

      if (scope === 'faculty' && faculty) {
        conditions.push(`faculty = $${index}`);
        values.push(faculty);
        index++;
      } else if (scope === 'degree' && degreeId) {
        conditions.push(`degree_id = $${index}`);
        values.push(degreeId);
        index++;
      }

      const res = await client.query(
        `SELECT id, registration_no, payment_slip_path 
         FROM students 
         WHERE ${conditions.join(' AND ')}`,
        values
      );
      return res.rows;
    });

    if (students.length === 0) {
      return NextResponse.json({ success: false, error: 'No payment slips found matching criteria.' }, { status: 404 });
    }

    const zip = new AdmZip();
    let addedCount = 0;

    for (const student of students) {
      const relativePath = student.payment_slip_path;
      // Strip initial slash if present
      const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      const absolutePath = path.join(process.cwd(), 'public', cleanPath);

      if (fs.existsSync(absolutePath)) {
        const fileExt = path.extname(cleanPath);
        const safeRegNo = student.registration_no.replace(/[\/\\:*?"<>|]/g, '_');
        const filename = `${safeRegNo}${fileExt}`;
        const fileBuffer = fs.readFileSync(absolutePath);
        zip.addFile(filename, fileBuffer);
        addedCount++;
      }
    }

    if (addedCount === 0) {
      return NextResponse.json({ success: false, error: 'No physical slip files found on server.' }, { status: 404 });
    }

    const zipBuffer = zip.toBuffer();
    const downloadName = `payment_slips_${scope}_${Date.now()}.zip`;

    // Log the download action in audit logs
    let auditAction = `Downloaded bulk payment slips for entire system`;
    if (scope === 'faculty') {
      auditAction = `Downloaded bulk payment slips for faculty: ${faculty}`;
    } else if (scope === 'degree') {
      auditAction = `Downloaded bulk payment slips for degree ID: ${degreeId}`;
    }
    await logAuditAction(session.username, auditAction);

    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
