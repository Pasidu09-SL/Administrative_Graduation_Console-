import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { runAsAdmin } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { student, inputs } = body;

    if (!student || !inputs) {
      return NextResponse.json({ success: false, error: 'Student and inputs are required.' }, { status: 400 });
    }

    // Write audit log
    await runAsAdmin(async (client) => {
      await client.query(
        `INSERT INTO audit_logs (admin_id, action_taken, student_id)
         VALUES ($1, $2, $3)`,
        [session.username, `Generated verification letter for student: Reg No=${student.registration_no}, Name=${student.name_with_initials}`, student.id]
      );
    });

    const templateDir = path.join(process.cwd(), 'public', 'templates');
    
    // Load Abhaya Libre & Pavanam font files as base64
    const fontSiPath = path.join(templateDir, 'AbhayaLibre-Regular.ttf');
    const fontTaPath = path.join(templateDir, 'Pavanam-Regular.ttf');
    
    let fontSiBase64 = '';
    let fontTaBase64 = '';
    
    if (fs.existsSync(fontSiPath)) {
      fontSiBase64 = fs.readFileSync(fontSiPath).toString('base64');
    }
    if (fs.existsSync(fontTaPath)) {
      fontTaBase64 = fs.readFileSync(fontTaPath).toString('base64');
    }

    const qrJsPath = path.join(templateDir, 'qrcode.min.js');
    let qrJsContent = '';
    if (fs.existsSync(qrJsPath)) {
      qrJsContent = fs.readFileSync(qrJsPath, 'utf8');
    }

    // Load University Logo
    const logoPath = path.join(templateDir, 'RUSL.png');
    let logoBase64 = '';
    if (fs.existsSync(logoPath)) {
      logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }

    // Determine Graduation Date by querying the convocation session if session_number is present
    let graduationDate = student.convocation_year || '';
    if (student.session_number) {
      const dbResult = await runAsAdmin(async (client) => {
        const res = await client.query(
          'SELECT session_date FROM convocation_sessions WHERE session_number = $1',
          [student.session_number]
        );
        return res.rows[0]?.session_date;
      });
      if (dbResult) {
        graduationDate = new Date(dbResult).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
      }
    }

    // Date formatting helper
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    };

    const formattedEffectiveDate = formatDate(student.effective_date) || student.convocation_year || '';
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const addresseeHtml = (inputs.addressee || '')
      .split('\n')
      .map((line: string) => `<div>${line}</div>`)
      .join('');

    const fields: [string, string][] = [
      ['Name of the Certificate', 'Degree Certificate'],
      ['Name in Full', student.full_name || student.name_with_initials || ''],
      ['Degree', student.degree_name_en || ''],
      ['Effective Date of the Degree', formattedEffectiveDate],
      ['Graduation Date', graduationDate],
      ['Serial No. of the Certificate', student.certificate_number ? String(student.certificate_number) : ''],
      ['Reg. NO / Index No.', `${student.registration_no || ''}  /  ${student.index_no || ''}`],
      ['Final GPA & Class', `${student.gpa ? Number(student.gpa).toFixed(2) : ' - '}${student.class ? ' - ' + student.class : ''}`],
    ];

    const fieldsHtml = fields
      .map(
        ([label, value], i) => `
      <div class="field-row">
        <div class="field-num">${i + 1}.</div>
        <div class="field-label">${label}</div>
        <div class="field-sep">-</div>
        <div class="field-value">${value}</div>
      </div>
    `
      )
      .join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@font-face {
  font-family: 'Abhaya Libre';
  src: url('data:font/ttf;base64,${fontSiBase64}') format('truetype');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'Abhaya Libre';
  src: url('data:font/ttf;base64,${fontSiBase64}') format('truetype');
  font-weight: bold;
  font-style: normal;
}
@font-face {
  font-family: 'Pavanam';
  src: url('data:font/ttf;base64,${fontTaBase64}') format('truetype');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'Pavanam';
  src: url('data:font/ttf;base64,${fontTaBase64}') format('truetype');
  font-weight: bold;
  font-style: normal;
}

@page {
  size: A4 portrait;
  margin: 0;
}
body {
  margin: 0;
  padding: 0;
  background-color: white;
  -webkit-print-color-adjust: exact;
}

.letter-page {
  position: relative;
  width: 210mm;
  height: 297mm;
  box-sizing: border-box;
  overflow: hidden;
  padding: 0 20mm;
  font-family: Arial, Helvetica, sans-serif;
  color: #000;
  line-height: 1.45;
}

.header-container {
  display: flex;
  align-items: center;
  margin-top: 10mm;
  margin-bottom: 2mm;
}
.logo {
  width: 25mm;
  height: 25mm;
  margin-right: 5mm;
  flex-shrink: 0;
}
.header-text {
  display: flex;
  flex-direction: column;
  color: #800000;
  text-align: left;
}
.uni-si {
  font-family: 'Abhaya Libre', serif;
  font-size: 15pt;
  font-weight: bold;
  line-height: 1.2;
}
.uni-ta {
  font-family: 'Pavanam', sans-serif;
  font-size: 12pt;
  font-weight: bold;
  line-height: 1.25;
}
.uni-en {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13pt;
  font-weight: bold;
  line-height: 1.2;
}

.divider-line {
  border: none;
  border-top: 0.8mm solid #800000;
  margin: 2mm 0;
}

.ref-section {
  display: flex;
  flex-direction: column;
  margin-top: 5mm;
  margin-bottom: 8mm;
  font-size: 9.5pt;
}
.ref-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
}
.ref-col-left {
  width: 90mm;
}
.ref-col-right {
  width: 80mm;
  display: flex;
  justify-content: flex-end;
}
.ref-lang-row {
  display: flex;
  align-items: center;
}
.ref-lang-labels {
  display: flex;
  flex-direction: column;
  text-align: left;
  line-height: 1.25;
  width: 20mm;
  flex-shrink: 0;
}
.ref-lang-labels .si-label {
  font-family: 'Abhaya Libre', serif;
  font-size: 8.5pt;
  font-weight: bold;
}
.ref-lang-labels .ta-label {
  font-family: 'Pavanam', sans-serif;
  font-size: 8pt;
  font-weight: bold;
}
.ref-lang-labels .en-label {
  font-size: 8pt;
  font-weight: bold;
}
.ref-brace {
  font-size: 24pt;
  font-weight: 300;
  font-family: 'Courier New', monospace;
  margin: 0 6px;
  line-height: 1;
  color: #333;
}
.ref-val {
  font-size: 9.5pt;
  flex-grow: 1;
}

.addressee-section {
  margin-bottom: 6mm;
  font-size: 9.5pt;
}

.subject-section {
  font-size: 9.5pt;
  margin-bottom: 7mm;
}
.subject-label {
  font-weight: bold;
}
.subject-text {
  font-weight: bold;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ref-sentence {
  font-size: 9.5pt;
  margin-bottom: 6mm;
}

.fields-section {
  margin-bottom: 6mm;
  font-size: 9.5pt;
}
.field-row {
  display: flex;
  margin-bottom: 2mm;
  align-items: flex-start;
}
.field-num {
  font-weight: bold;
  width: 6mm;
}
.field-label {
  font-weight: bold;
  width: 56mm;
}
.field-sep {
  width: 5mm;
  text-align: center;
}
.field-value {
  flex: 1;
  word-break: break-word;
}

.closing-section {
  font-size: 9.5pt;
  margin-bottom: 12mm;
}

.signature-section {
  font-size: 9.5pt;
}
.signature-name {
  margin-bottom: 1.5mm;
}
.signature-title {
  font-weight: bold;
}

.footer-container {
  position: absolute;
  bottom: 12mm;
  left: 20mm;
  right: 20mm;
  display: flex;
  align-items: flex-start;
  height: 70px;
}
.footer-qr {
  width: 70px;
  height: 70px;
  margin-right: 4mm;
  flex-shrink: 0;
}
.footer-text {
  flex-grow: 1;
  height: 70px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 9.5pt;
  color: #333;
  line-height: 1.2;
}
.footer-line-1 {
  font-weight: bold;
  color: #000;
  margin: 0;
  padding: 0;
}
.footer-line-2, .footer-line-3 {
  color: #444;
  margin: 0;
  padding: 0;
}
.footer-band {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 5mm;
}
</style>
</head>
<body>
<div class="letter-page">
  <div class="header-container">
    <img class="logo" src="${logoBase64}" />
    <div class="header-text">
      <div class="uni-si">ශ්‍රී ලංකා රජරට විශ්වවිද්‍යාලය</div>
      <div class="uni-ta">இலங்கை රජரட்ட பல்கலைக்கழகம்</div>
      <div class="uni-en">Rajarata University of Sri Lanka</div>
    </div>
  </div>
  
  <hr class="divider-line" />
  
  <div class="ref-section">
    <div class="ref-row">
      <div class="ref-col-left">
        <!-- Your No Block -->
        <div class="ref-lang-row">
          <div class="ref-lang-labels">
            <span class="si-label">ඔබේ අංකය</span>
            <span class="ta-label">உங்கள் எண்</span>
            <span class="en-label">Your No.</span>
          </div>
          <div class="ref-brace">}</div>
          <div class="ref-val">${inputs.yourNumber || '................................'}</div>
        </div>
      </div>
      <div class="ref-col-right">
        <!-- My No Block -->
        <div class="ref-lang-row">
          <div class="ref-lang-labels">
            <span class="si-label">මගේ අංකය</span>
            <span class="ta-label">எனது எண்</span>
            <span class="en-label">My No.</span>
          </div>
          <div class="ref-brace">}</div>
          <div class="ref-val">${inputs.myNumber || '................................'}</div>
        </div>
      </div>
    </div>
    
    <div class="ref-row" style="margin-top: 5mm;">
      <div class="ref-col-left">
        <!-- Date Block -->
        <div class="ref-lang-row">
          <div class="ref-lang-labels">
            <span class="si-label">දිනය</span>
            <span class="ta-label">திகதி</span>
            <span class="en-label">Date</span>
          </div>
          <div class="ref-brace">}</div>
          <div class="ref-val">${today}</div>
        </div>
      </div>
      <div class="ref-col-right"></div>
    </div>
  </div>
  
  <div class="addressee-section">
    ${addresseeHtml}
  </div>
  
  <div class="subject-section">
    <span class="subject-label">Subject:</span>
    <span class="subject-text">Verification of Degree Certificate - ${student.name_with_initials}</span>
  </div>
  
  <div class="ref-sentence">
    This has reference to your letter ${inputs.refLetterDate || '........................'} on the above subject.
  </div>
  
  <div class="fields-section">
    ${fieldsHtml}
  </div>
  
  <div class="closing-section">
    I am pleased to inform you that the above information is Genuine and the Degree has been awarded by the Rajarata University of Sri Lanka.
  </div>
  
  <div class="signature-section">
    <div class="signature-name">${inputs.staffName || '.......................................................'}</div>
    <div class="signature-title">${inputs.staffDesignation || 'Deputy Registrar'}</div>
  </div>
  
  <div class="footer-container">
    <div id="qrcode" class="footer-qr"></div>
    <div class="footer-text">
      <div class="footer-line-1">Rajarata University of Sri Lanka, Mihintale – 50300, Sri Lanka</div>
      <div class="footer-line-2">Web: www.rjt.ac.lk | Email: info@rjt.ac.lk</div>
      <div class="footer-line-3">+94-252266650</div>
    </div>
  </div>
  <div class="footer-band">
    <svg width="210mm" height="5mm" viewBox="0 0 210 5" style="display: block; width: 100%; height: 100%;">
      <!-- Yellow start block -->
      <path d="M 0,4.5 L 5,4.5 L 5,4.0 L 0,4.0 Z" fill="#fbbf24" />
      <!-- Thin red line -->
      <path d="M 5,4.5 L 140,4.5 L 140,4.0 L 5,4.0 Z" fill="#800000" />
      <!-- Yellow diagonal transition slice -->
      <path d="M 140,4.5 L 143,4.5 L 145,1.3 L 142,1.3 Z" fill="#fbbf24" />
      <!-- Thick red block -->
      <path d="M 143,4.5 L 210,4.5 L 210,1.3 L 145,1.3 Z" fill="#800000" />
    </svg>
  </div>
</div>

<script>
  // Inline the qrcode.js library
  ${qrJsContent}
  
  // Initialize the QR Code
  new QRCode(document.getElementById("qrcode"), {
    text: "https://www.rjt.ac.lk/contacts/",
    width: 70,
    height: 70,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.M
  });
</script>
</body>
</html>
`;

    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' as any });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '0px',
        bottom: '0px',
        left: '0px',
        right: '0px',
      },
      printBackground: true,
    });

    await browser.close();

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuffer.length),
        'Content-Disposition': `inline; filename="Verification_Letter_${student.registration_no || student.index_no}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
