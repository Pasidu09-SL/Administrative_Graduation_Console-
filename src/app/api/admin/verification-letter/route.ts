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
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 15mm;
  margin-bottom: 2mm;
}
.header-left {
  text-align: left;
  width: 70mm;
}
.header-center {
  text-align: center;
  width: 30mm;
}
.header-right {
  text-align: right;
  width: 70mm;
}
.logo {
  width: 20mm;
  height: 20mm;
  display: block;
  margin: 0 auto;
}
.uni-si, .loc-si {
  font-family: 'Abhaya Libre', serif;
  font-size: 11.5pt;
  font-weight: bold;
  line-height: 1.25;
}
.uni-ta, .loc-ta {
  font-family: 'Pavanam', sans-serif;
  font-size: 10pt;
  font-weight: bold;
  line-height: 1.25;
}
.uni-en {
  font-size: 8.5pt;
  font-weight: bold;
  margin-top: 4pt;
}
.loc-en {
  font-size: 8.5pt;
  margin-top: 4pt;
}

.divider-line {
  border: none;
  border-top: 0.4mm solid #000;
  margin: 2mm 0;
}
.contact-info {
  font-size: 7.5pt;
  text-align: center;
  margin: 1mm 0;
}

.ref-section {
  display: flex;
  justify-content: space-between;
  margin-top: 7mm;
  margin-bottom: 9mm;
  font-size: 9.5pt;
}
.ref-left {
  width: 80mm;
}
.ref-right {
  width: 80mm;
}
.ref-row {
  display: flex;
  margin-bottom: 1.5mm;
}
.ref-label {
  font-weight: bold;
  width: 28mm;
}
.ref-value {
  width: 52mm;
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
</style>
</head>
<body>
<div class="letter-page">
  <div class="header-container">
    <div class="header-left">
      <div class="uni-si">ශ්‍රී ලංකා රජරට විශ්වවිද්‍යාලය</div>
      <div class="uni-ta">இலங்கை ரஜராஜ பல்கலைக்கழகம்</div>
      <div class="uni-en">Rajarata University of Sri Lanka</div>
    </div>
    <div class="header-center">
      <img class="logo" src="${logoBase64}" />
    </div>
    <div class="header-right">
      <div class="loc-si">මිහින්තලේ, ශ්‍රී ලංකාව</div>
      <div class="loc-ta">மிஹிந்தலை, இலங்கை</div>
      <div class="loc-en">Mihinthale Sri Lanka</div>
    </div>
  </div>
  
  <hr class="divider-line" />
  <div class="contact-info">
    Tel: +94 25 226 5600  |  Fax: +94 25 226 5601  |  Email: registrar@rjt.ac.lk
  </div>
  <hr class="divider-line" />
  
  <div class="ref-section">
    <div class="ref-left">
      <div class="ref-row">
        <span class="ref-label">Your Number:</span>
        <span class="ref-value">${inputs.yourNumber || '.....................'}</span>
      </div>
      <div class="ref-row">
        <span class="ref-label">Our Ref:</span>
        <span class="ref-value">${inputs.ourRef || '.....................'}</span>
      </div>
    </div>
    <div class="ref-right">
      <div class="ref-row">
        <span class="ref-label">My Number:</span>
        <span class="ref-value">${inputs.myNumber || '.....................'}</span>
      </div>
      <div class="ref-row">
        <span class="ref-label">File Number:</span>
        <span class="ref-value">${inputs.fileNumber || '.....................'}</span>
      </div>
      <div class="ref-row">
        <span class="ref-label">Date:</span>
        <span class="ref-value">${today}</span>
      </div>
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
    <div class="signature-title">Deputy Registrar</div>
  </div>
</div>
</body>
</html>
`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' as any });

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
