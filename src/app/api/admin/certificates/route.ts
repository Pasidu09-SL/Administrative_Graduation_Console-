import { NextResponse } from 'next/server';
import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import { runAsAdmin } from '@/lib/db';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
async function ensureTemplates() {
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

  const templates = [
    { pdfName: 'internal_front.pdf', jpgName: 'internal_front.jpg', fallbackText: 'UNIVERSITY OF GRADUATION - INTERNAL DEGREE (FRONT)' },
    { pdfName: 'internal_back.pdf', jpgName: 'internal_back.jpg', fallbackText: 'OFFICIAL UNIVERSITY SEAL & REGISTRAR SIGNATURE (BACK)' },
    { pdfName: 'external_front.pdf', jpgName: 'external_front.jpg', fallbackText: 'UNIVERSITY OF GRADUATION - EXTERNAL DEGREE (FRONT)' },
    { pdfName: 'external_back.pdf', jpgName: 'external_back.jpg', fallbackText: 'OFFICIAL UNIVERSITY SEAL & REGISTRAR SIGNATURE (BACK)' }
  ];

  for (const t of templates) {
    const pdfPath = path.join(dir, t.pdfName);
    const jpgPath = path.join(dir, t.jpgName);
    
    if (!fs.existsSync(pdfPath)) {
      const doc = await PDFDocument.create();
      const page = doc.addPage([595.275, 841.89]); // A4 Size in points
      
      if (fs.existsSync(jpgPath)) {
        try {
          const jpgBytes = fs.readFileSync(jpgPath);
          const embeddedJpg = await doc.embedJpg(jpgBytes);
          page.drawImage(embeddedJpg, {
            x: 0,
            y: 0,
            width: page.getWidth(),
            height: page.getHeight(),
          });
        } catch (err: any) {
          console.error(`Failed to embed JPG template for ${t.pdfName}:`, err.message);
        }
      } else {
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        // Draw template decoration border
        page.drawRectangle({
          x: 15,
          y: 15,
          width: 565.275,
          height: 811.89,
          borderColor: rgb(0.09, 0.29, 0.65),
          borderWidth: 3,
        });

        // Label background for debugging verification
        page.drawText(t.fallbackText, {
          x: 60,
          y: 750,
          size: 16,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
      }

      const bytes = await doc.save();
      fs.writeFileSync(pdfPath, bytes);
    }
  }
}

export async function GET() {
  return NextResponse.json({ success: true, data: global.certTaskStatus });
}

export async function POST() {
  try {
    if (global.certTaskStatus?.status === 'processing') {
      return NextResponse.json({ success: false, error: 'A certificate generation task is already in progress.' }, { status: 400 });
    }

    // Ensure templates are generated and cached
    await ensureTemplates();

    // Query approved students with assigned seating/certificate numbers
    const students = await runAsAdmin(async (client) => {
      const res = await client.query(`
        SELECT s.id, s.full_name, s.index_no, s.certificate_number, d.name_en as degree_name_en, d.name_si as degree_name_si, d.name_ta as degree_name_ta, d.type as degree_type
        FROM students s
        JOIN degrees d ON s.degree_id = d.id
        WHERE s.verification_status = 'Approved' 
          AND s.certificate_number IS NOT NULL
        ORDER BY s.index_no ASC
      `);
      return res.rows;
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
        templateDir: path.join(process.cwd(), 'public', 'templates')
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
