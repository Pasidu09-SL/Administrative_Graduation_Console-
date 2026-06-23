import { NextResponse } from 'next/server';
import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import { runAsAdmin } from '@/lib/db';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getAdminSession } from '@/lib/auth';
import { DEFAULT_LAYOUT } from '@/app/api/admin/certificate-layout/route';

// Extend node global scope for status tracking
declare global {
  var certTaskStatus: {
    status: 'idle' | 'processing' | 'completed' | 'failed';
    current: number;
    total: number;
    error: string | null;
    outputPath: string | null;
  } | undefined;
}

if (!global.certTaskStatus) {
  global.certTaskStatus = { status: 'idle', current: 0, total: 0, error: null, outputPath: null };
}

/**
 * Automatically creates mock templates for Internal Front/Back and External Front/Back
 * to act as cached high-resolution layouts for coordinate text injection.
 */
function drawCenteredParagraph(page: any, text: string, font: any, size: number, yStart: number, maxW: number, lineGap: number = 4) {
  const words = text.split(' ');
  let lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, size);
    if (width > maxW) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  
  let currentY = yStart;
  for (const line of lines) {
    const w = font.widthOfTextAtSize(line, size);
    page.drawText(line, {
      x: (page.getWidth() - w) / 2,
      y: currentY,
      font,
      size,
      color: rgb(0.1, 0.1, 0.1),
    });
    currentY -= (size + lineGap);
  }
}

function drawGradingTable(page: any, font: any, fontBold: any, yTop: number) {
  const tableX = 77.6375; // Centered
  const colWidth = 110;
  const tableWidth = 440;
  const rowHeight = 16;
  const headerHeight = 20;

  const headers = ["Grading", "Regulation", "Relevance", "Status"];
  const rows = [
    ["First Class", "GPA >= 3.70", "Excellent", "Awarded"],
    ["Second Upper", "3.30 - 3.69", "Very Good", "Awarded"],
    ["Second Lower", "3.00 - 3.29", "Good", "Awarded"],
    ["Pass", "2.00 - 2.99", "Satisfactory", "Awarded"]
  ];

  // Draw Header Row background
  page.drawRectangle({
    x: tableX,
    y: yTop - headerHeight,
    width: tableWidth,
    height: headerHeight,
    color: rgb(0.95, 0.95, 0.95),
  });

  // Draw Header text
  for (let i = 0; i < headers.length; i++) {
    const text = headers[i];
    const textW = fontBold.widthOfTextAtSize(text, 10);
    page.drawText(text, {
      x: tableX + i * colWidth + (colWidth - textW) / 2,
      y: yTop - headerHeight + 5,
      font: fontBold,
      size: 10,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  // Draw Rows
  let currentY = yTop - headerHeight;
  for (let r = 0; r < rows.length; r++) {
    currentY -= rowHeight;
    const row = rows[r];
    // Alternate row background colors
    if (r % 2 === 1) {
      page.drawRectangle({
        x: tableX,
        y: currentY,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.98, 0.98, 0.98),
      });
    }

    for (let i = 0; i < row.length; i++) {
      const text = row[i];
      const textW = font.widthOfTextAtSize(text, 9);
      page.drawText(text, {
        x: tableX + i * colWidth + (colWidth - textW) / 2,
        y: currentY + 4,
        font,
        size: 9,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
  }

  // Draw Borders (Horizontal grid lines)
  let lineY = yTop;
  page.drawLine({ start: { x: tableX, y: lineY }, end: { x: tableX + tableWidth, y: lineY }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
  lineY -= headerHeight;
  page.drawLine({ start: { x: tableX, y: lineY }, end: { x: tableX + tableWidth, y: lineY }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
  for (let r = 0; r < rows.length; r++) {
    lineY -= rowHeight;
    page.drawLine({ start: { x: tableX, y: lineY }, end: { x: tableX + tableWidth, y: lineY }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  }

  // Draw Vertical grid lines
  for (let i = 0; i <= headers.length; i++) {
    page.drawLine({
      start: { x: tableX + i * colWidth, y: yTop },
      end: { x: tableX + i * colWidth, y: yTop - headerHeight - rows.length * rowHeight },
      thickness: 0.5,
      color: rgb(0.5, 0.5, 0.5),
    });
  }
}

function patchFontkit() {
  try {
    const fontkitDir = path.join(process.cwd(), 'node_modules', '@pdf-lib', 'fontkit');
    if (!fs.existsSync(fontkitDir)) return;

    const replaceInFile = (filePath: string) => {
      let content = fs.readFileSync(filePath, 'utf8');
      let changed = false;

      const regex1 = /var\s+syllable\s*=\s*glyphs\s*\[\s*start\s*\]\s*\.\s*shaperInfo\s*\.\s*syllable\s*;([\s\S]*?)while\s*\(\s*\+\+\s*start\s*<\s*glyphs\.length\s*&&\s*glyphs\s*\[\s*start\s*\]\s*\.\s*shaperInfo\s*\.\s*syllable\s*===\s*syllable\s*\)/g;
      const replacementStr1 = `var syllable = glyphs[start].shaperInfo ? glyphs[start].shaperInfo.syllable : null;$1while (++start < glyphs.length && (glyphs[start].shaperInfo ? glyphs[start].shaperInfo.syllable : null) === syllable)`;

      if (regex1.test(content)) {
        content = content.replace(regex1, replacementStr1);
        changed = true;
      }

      const regex2 = /var\s+info\s*=\s*glyphs\s*\[\s*start\s*\]\s*\.\s*shaperInfo\s*;\s*var\s+type\s*=\s*info\s*\.\s*syllableType\s*;/g;
      const replacementStr2 = `var info = glyphs[start].shaperInfo;\n    if (!info) continue;\n    var type = info.syllableType;`;

      if (regex2.test(content)) {
        content = content.replace(regex2, replacementStr2);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[Fontkit Patch] Successfully patched fontkit at: ${filePath}`);
      }
    };

    const walk = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (file.endsWith('.js')) {
          replaceInFile(fullPath);
        }
      }
    };

    walk(fontkitDir);
  } catch (err: any) {
    console.error('Failed to patch fontkit dynamically:', err.message);
  }
}

/**
 * Automatically creates mock templates for Internal Front/Back and External Front/Back
 * to act as cached high-resolution layouts for coordinate text injection.
 */
async function ensureTemplates() {
  // Apply the dynamic fontkit patch to prevent complex Sinhala/Tamil character crashes
  patchFontkit();

  const dir = path.join(process.cwd(), 'public', 'templates');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Download TrueType Fonts for Sinhala and Tamil rendering
  const fontFiles = [
    { name: 'AbhayaLibre-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/abhayalibre/AbhayaLibre-Regular.ttf' },
    { name: 'Pavanam-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/pavanam/Pavanam-Regular.ttf' }
  ];

  for (const f of fontFiles) {
    const fontPath = path.join(dir, f.name);
    if (!fs.existsSync(fontPath)) {
      try {
        console.log(`Downloading font ${f.name} from ${f.url}...`);
        const fontRes = await fetch(f.url);
        if (!fontRes.ok) throw new Error(`Status ${fontRes.status}`);
        const buffer = await fontRes.arrayBuffer();
        fs.writeFileSync(fontPath, Buffer.from(buffer));
        console.log(`Font ${f.name} downloaded successfully.`);
      } catch (err: any) {
        console.error(`Failed to download font ${f.name}:`, err.message);
      }
    }
  }

  const frontTypes: ('Internal' | 'External')[] = ['Internal', 'External'];

  for (const type of frontTypes) {
    const pdfName = `${type.toLowerCase()}_front.pdf`;
    const pdfPath = path.join(dir, pdfName);

    // Generate Front PDF Template
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.275, 841.89]); // A4 Size

    // Elegant borders
    page.drawRectangle({
      x: 20,
      y: 20,
      width: 555.275,
      height: 801.89,
      borderColor: rgb(0.15, 0.15, 0.15),
      borderWidth: 1.5,
    });
    page.drawRectangle({
      x: 23,
      y: 23,
      width: 549.275,
      height: 795.89,
      borderColor: rgb(0.15, 0.15, 0.15),
      borderWidth: 0.5,
    });

    const bytes = await doc.save();
    fs.writeFileSync(pdfPath, bytes);
  }

  // Generate Back PDF Templates
  const backNames = ['internal_back.pdf', 'external_back.pdf'];
  for (const backName of backNames) {
    const pdfPath = path.join(dir, backName);
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.275, 841.89]); // A4 Size

    // Borders (replicate Front borders)
    page.drawRectangle({
      x: 20,
      y: 20,
      width: 555.275,
      height: 801.89,
      borderColor: rgb(0.15, 0.15, 0.15),
      borderWidth: 1.5,
    });
    page.drawRectangle({
      x: 23,
      y: 23,
      width: 549.275,
      height: 795.89,
      borderColor: rgb(0.15, 0.15, 0.15),
      borderWidth: 0.5,
    });

    const bytes = await doc.save();
    fs.writeFileSync(pdfPath, bytes);
  }
}

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: true, data: global.certTaskStatus });
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

    const body = await req.json().catch(() => ({}));
    const { faculty, degreeId, studentId } = body;

    if (!studentId && (!faculty || !degreeId)) {
      return NextResponse.json({ success: false, error: 'Faculty and Degree selection or Student ID is required.' }, { status: 400 });
    }

    if (studentId) {
      // Ensure templates are generated and cached
      await ensureTemplates();

      try {
        const { student, layoutData } = await runAsAdmin(async (client) => {
          const res = await client.query(`
            SELECT s.id, s.full_name, s.index_no, s.certificate_number, s.registration_no, s.faculty, s.degree_id, s.convocation_year, d.name_en as degree_name_en, d.name_si as degree_name_si, d.name_ta as degree_name_ta, d.type as degree_type
            FROM students s
            JOIN degrees d ON s.degree_id = d.id
            WHERE s.id = $1 AND s.verification_status = 'Approved' AND s.certificate_number IS NOT NULL
          `, [studentId]);
          
          if (res.rows.length === 0) {
            throw new Error('Student record not found or not approved/allocated certificate.');
          }

          const sRec = res.rows[0];

          const layoutRes = await client.query(
            "SELECT layout_data FROM certificate_layouts WHERE convocation_year = $1",
            [sRec.convocation_year || '2026']
          );
          const dbLayout = layoutRes.rows[0]?.layout_data || {};
          const mergedLayout = { ...DEFAULT_LAYOUT, ...dbLayout };

          // Write audit log
          await client.query(
            `INSERT INTO audit_logs (admin_id, action_taken, student_id)
             VALUES ($1, $2, $3)`,
            [session.username, `Generated individual certificate for student: Reg No=${sRec.registration_no}, Name=${sRec.full_name}`, studentId]
          );

          return {
            student: sRec,
            layoutData: mergedLayout
          };
        });

        const outputDir = path.join(process.cwd(), 'public', 'certificates');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        const outputPath = path.join(outputDir, `individual_${studentId}_${Date.now()}.pdf`);

        // Spawn the Node Worker Thread synchronously
        const workerPath = path.join(process.cwd(), 'src', 'lib', 'pdf-worker.js');
        const fileBytes = await new Promise<Buffer>((resolve, reject) => {
          const worker = new Worker(workerPath, {
            workerData: {
              students: [student],
              outputPath,
              templateDir: path.join(process.cwd(), 'public', 'templates'),
              layoutData
            }
          });
          worker.on('message', (msg) => {
            if (msg.type === 'done') {
              try {
                const bytes = fs.readFileSync(msg.outputPath);
                fs.unlinkSync(msg.outputPath); // clean up
                resolve(bytes);
              } catch (err) {
                reject(err);
              }
            } else if (msg.type === 'error') {
              reject(new Error(msg.error));
            }
          });
          worker.on('error', reject);
        });

        return new Response(new Uint8Array(fileBytes), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': String(fileBytes.length),
            'Content-Disposition': `attachment; filename="Certificate_${student.registration_no || student.index_no}.pdf"`,
          },
        });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    if (global.certTaskStatus?.status === 'processing') {
      return NextResponse.json({ success: false, error: 'A certificate generation task is already in progress.' }, { status: 400 });
    }

    // Ensure templates are generated and cached
    await ensureTemplates();

    // Query approved students with assigned seating/certificate numbers matching selected faculty & degree
    const { students, layoutData } = await runAsAdmin(async (client) => {
      const activeYearRes = await client.query(
        "SELECT convocation_year FROM registration_windows WHERE is_active = TRUE LIMIT 1"
      );
      const activeYear = activeYearRes.rows[0]?.convocation_year || '2026';

      const res = await client.query(`
        SELECT s.id, s.full_name, s.index_no, s.certificate_number, d.name_en as degree_name_en, d.name_si as degree_name_si, d.name_ta as degree_name_ta, d.type as degree_type
        FROM students s
        JOIN degrees d ON s.degree_id = d.id
        WHERE s.verification_status = 'Approved' 
          AND s.certificate_number IS NOT NULL
          AND s.faculty = $1
          AND s.degree_id = $2
          AND s.convocation_year = $3
        ORDER BY s.index_no ASC
      `, [faculty, degreeId, activeYear]);

      const layoutRes = await client.query(
        "SELECT layout_data FROM certificate_layouts WHERE convocation_year = $1",
        [activeYear]
      );
      const dbLayout = layoutRes.rows[0]?.layout_data || {};
      const mergedLayout = { ...DEFAULT_LAYOUT, ...dbLayout };

      if (res.rows.length > 0) {
        // Write audit log
        await client.query(
          `INSERT INTO audit_logs (admin_id, action_taken)
           VALUES ($1, $2)`,
          [session.username, `Initiated bulk certificate generation for faculty='${faculty}', degree_id='${degreeId}' (${res.rows.length} candidates)`]
        );
      }

      return {
        students: res.rows,
        layoutData: mergedLayout
      };
    });

    if (students.length === 0) {
      return NextResponse.json({ success: false, error: 'No approved students with seating allocations found.' }, { status: 400 });
    }

    const outputDir = path.join(process.cwd(), 'public', 'certificates');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, `master_certificates_${Date.now()}.pdf`);

    // Set singleton progress tracking status
    global.certTaskStatus = {
      status: 'processing',
      current: 0,
      total: students.length,
      error: null,
      outputPath: null
    };

    // Spawn the Node Worker Thread
    const workerPath = path.join(process.cwd(), 'src', 'lib', 'pdf-worker.js');
    const worker = new Worker(workerPath, {
      workerData: {
        students,
        outputPath,
        templateDir: path.join(process.cwd(), 'public', 'templates'),
        layoutData
      }
    });

    // Event hooks to monitor progress
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        if (global.certTaskStatus) {
          global.certTaskStatus.current = msg.current;
        }
      } else if (msg.type === 'done') {
        if (global.certTaskStatus) {
          global.certTaskStatus.status = 'completed';
          global.certTaskStatus.outputPath = `/certificates/${path.basename(msg.outputPath)}`;
        }
      } else if (msg.type === 'error') {
        if (global.certTaskStatus) {
          global.certTaskStatus.status = 'failed';
          global.certTaskStatus.error = msg.error;
        }
      }
    });

    worker.on('error', (err) => {
      console.error('Worker thread error:', err);
      if (global.certTaskStatus) {
        global.certTaskStatus.status = 'failed';
        global.certTaskStatus.error = err.message;
      }
    });

    // Return 202 Accepted immediately
    return NextResponse.json({ success: true, message: 'Certificate generation task initiated successfully.' }, { status: 202 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
