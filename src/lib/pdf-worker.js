const { parentPort, workerData } = require('worker_threads');
require('regenerator-runtime/runtime');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
// puppeteer is loaded via dynamic import() inside generate() because it is a
// pure-ESM package that cannot be loaded with require() in a CJS context.

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read a binary file and return a base64 data-URL string for HTML embedding. */
function toBase64DataUrl(filePath, mimeType) {
  const data = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${data.toString('base64')}`;
}

/** Escape characters that could break HTML attribute or text content. */
function escHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Convert \n-delimited text to <br> tags for HTML paragraphs. */
function nl2br(str) {
  return escHtml(str || '').replace(/\n/g, '<br>');
}

// ─── Back-page HTML builder ───────────────────────────────────────────────────

/**
 * Builds a self-contained A4 HTML page for the certificate back side.
 * Fonts are embedded as base64 data-URLs so no network access is needed at
 * render time and Chrome's HarfBuzz shaper handles Sinhala/Tamil correctly.
 */
function buildBackPageHtml({ student, layoutData, fontSiBase64, fontTaBase64, logoBase64 }) {
  const isInternal = student.degree_type === 'Internal';

  const preambleSi = isInternal
    ? (layoutData.preambleSiInternal || 'මෙම විශ්වවිද්‍යාලයේ අභ්‍යන්තර අපේක්ෂකයෙකු ලෙස\nනියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක\nලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම\nසඳහන් අය වෙත')
    : (layoutData.preambleSiExternal || 'මෙම විශ්වවිද්‍යාලයේ බාහිර අපේක්ෂකයෙකු ලෙස\nනියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක\nලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම\nසඳහන් අය වෙත');

  const preambleTa = isInternal
    ? (layoutData.preambleTaInternal || 'இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட உள்வாரி கற்கை\nநெறிகளையும் பரீட்சைகளையும் வெற்றிகரமாக\nநிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்\nமறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு')
    : (layoutData.preambleTaExternal || 'இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட வெளிவாரி கற்கை\nநெறிகளையும் பரீட்சைகளையும் வெற்றிகரமாக\nநிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்\nமறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு');

  const suffixSi  = layoutData.suffixSi  || 'පිරිනමන ලද බව මෙයින් සහතික කරමු.';
  const suffixTa  = layoutData.suffixTa  || 'வழங்கப்பட்டதென இத்தால்\nஉறுதிப்படுத்துகின்றோம்.';
  const dateSi1   = layoutData.dateSiLine1 || 'වලංගු වීමේ දිනය: 15/01/2023';
  const dateSi2   = layoutData.dateSiLine2 || 'උපාධි ප්‍රදානෝත්සවය: 2023 ජූලි මස 27';
  const dateTa1   = layoutData.dateTaLine1 || 'செல்லுபடியாகும் திகதி: 15/01/2023';
  const dateTa2   = layoutData.dateTaLine2 || 'பட்டமளிப்பு விழா: 27 ஜூலை 2023';
  const regName   = layoutData.registrarName  || 'එස්.සී. හේරත් / எஸ்.சி.ஹேரத்';
  const regTitle  = layoutData.registrarTitle || 'ලේඛකාධිකාරි / பதிவாளர்';
  const vcName    = layoutData.vcName  || 'වෛද්‍ය පී.එච්.ජේ. පුෂ්පකුමාර / வைத்தியர் பி.எச்.ஜி.ஜே. புஷ்பகுமார';
  const vcTitle   = layoutData.vcTitle || 'වැඩ බලන උපකුලපති / பதில் உபவேந்தர்';

  const siDegree  = escHtml(student.degree_name_si || '');
  const taDegree  = escHtml(student.degree_name_ta || '');
  const certNum   = escHtml(String(student.certificate_number || ''));

  const logoTag = logoBase64
    ? `<img class="logo" src="${logoBase64}" alt="University Logo">`
    : '';

  // Font @font-face declarations (only if TTF files were found)
  const fontFaceSi = fontSiBase64
    ? `@font-face { font-family: 'AbhayaLibre'; src: url('${fontSiBase64}') format('truetype'); font-weight: normal; font-style: normal; }`
    : '';
  const fontFaceTa = fontTaBase64
    ? `@font-face { font-family: 'Pavanam'; src: url('${fontTaBase64}') format('truetype'); font-weight: normal; font-style: normal; }`
    : '';

  return /* html */`<!DOCTYPE html>
<html lang="si">
<head>
<meta charset="UTF-8">
<style>
  ${fontFaceSi}
  ${fontFaceTa}

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    width: 210mm;
    height: 297mm;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    position: relative;
    width: 210mm;
    height: 297mm;
    overflow: hidden;
    background: #fff;
  }

  /* ── Borders ── */
  .border-outer {
    position: absolute;
    inset: 7.06mm;
    border: 0.53mm solid #262626;
    pointer-events: none;
  }
  .border-inner {
    position: absolute;
    inset: 8.12mm;
    border: 0.18mm solid #262626;
    pointer-events: none;
  }

  /* ── Logo ── */
  .logo {
    position: absolute;
    top: 14.1mm;
    left: 50%;
    transform: translateX(-50%);
    width: 25mm;
    height: 25mm;
    object-fit: contain;
  }

  /* ── English university title ── */
  .uni-title {
    position: absolute;
    top: 41mm;
    left: 0;
    right: 0;
    text-align: center;
    font-family: 'Times New Roman', Times, serif;
    font-weight: bold;
    font-size: 12.5pt;
    color: #1a1a1a;
    letter-spacing: 0.4px;
  }

  /* ── Certificate number (top-right) ── */
  .cert-number {
    position: absolute;
    top: 10mm;
    right: 15.5mm;
    font-family: 'Times New Roman', Times, serif;
    font-weight: bold;
    font-size: 7pt;
    color: #1a1a1a;
  }

  /* ── Grading table ── */
  .grading-wrap {
    position: absolute;
    top: 49mm;
    left: 27mm;
    right: 27mm;
  }
  .grading-table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'Times New Roman', Times, serif;
    font-size: 8pt;
    color: #222;
  }
  .grading-table th {
    background: #f0f0f0;
    font-weight: bold;
    padding: 1.8mm 1mm;
    text-align: center;
    border: 0.18mm solid #808080;
  }
  .grading-table td {
    padding: 1.4mm 1mm;
    text-align: center;
    border: 0.18mm solid #b0b0b0;
  }
  .grading-table tr:nth-child(even) td { background: #fafafa; }

  /* ── Divider line ── */
  .divider {
    position: absolute;
    left: 15.9mm;
    right: 15.9mm;
    height: 0.18mm;
    background: #bbb;
  }

  /* ── Bilingual two-column block ── */
  .bilingual {
    position: absolute;
    left: 15.9mm;
    right: 15.9mm;
    display: flex;
    gap: 0;
    align-items: flex-start;
  }

  .col {
    flex: 1;
    overflow: hidden;
  }
  .col-si {
    padding-right: 3.5mm;
    border-right: 0.18mm solid #ccc;
    font-family: 'AbhayaLibre', serif;
  }
  .col-ta {
    padding-left: 3.5mm;
    font-family: 'Pavanam', sans-serif;
  }

  .col-heading {
    font-size: 10pt;
    text-align: center;
    color: #111;
    margin-bottom: 2.2mm;
    line-height: 1.4;
  }
  .col-si .col-heading { font-family: 'AbhayaLibre', serif; }
  .col-ta .col-heading { font-family: 'Pavanam', sans-serif; }

  .preamble {
    font-size: 8.3pt;
    line-height: 1.65;
    color: #2b2b2b;
    margin-bottom: 2mm;
  }
  .col-si .preamble { font-family: 'AbhayaLibre', serif; }
  .col-ta .preamble { font-family: 'Pavanam', sans-serif; }

  .degree-name {
    font-size: 10pt;
    text-align: center;
    color: #111;
    margin-bottom: 2mm;
    line-height: 1.4;
  }
  .col-si .degree-name { font-family: 'AbhayaLibre', serif; }
  .col-ta .degree-name { font-family: 'Pavanam', sans-serif; }

  .suffix {
    font-size: 8.3pt;
    color: #2b2b2b;
    margin-bottom: 2.5mm;
    line-height: 1.55;
  }
  .col-si .suffix { font-family: 'AbhayaLibre', serif; }
  .col-ta .suffix { font-family: 'Pavanam', sans-serif; }

  .dates {
    font-size: 7.5pt;
    color: #4d4d4d;
    line-height: 1.7;
  }
  .col-si .dates { font-family: 'AbhayaLibre', serif; }
  .col-ta .dates { font-family: 'Pavanam', sans-serif; }

  /* ── Signature section ── */
  .sig-section {
    position: absolute;
    bottom: 15mm;
    left: 15.9mm;
    right: 15.9mm;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .sig-block {
    text-align: center;
    width: 55mm;
  }
  .sig-line {
    border-top: 0.26mm solid #333;
    width: 42mm;
    margin: 0 auto 1.5mm;
  }
  .sig-name, .sig-title {
    font-family: 'AbhayaLibre', serif;
    font-size: 6.8pt;
    color: #333;
    line-height: 1.4;
  }

  /* ── Official seal ── */
  .seal {
    width: 30mm;
    height: 30mm;
    border-radius: 50%;
    border: 0.53mm solid #cc1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
  }
  .seal::after {
    content: '';
    position: absolute;
    inset: 1mm;
    border-radius: 50%;
    border: 0.18mm solid #cc1a1a;
  }
  .seal-text {
    font-family: 'Times New Roman', Times, serif;
    font-size: 7pt;
    font-weight: bold;
    color: #cc1a1a;
    z-index: 1;
  }
</style>
</head>
<body>
<div class="page">

  <!-- Decorative borders -->
  <div class="border-outer"></div>
  <div class="border-inner"></div>

  <!-- University logo -->
  ${logoTag}

  <!-- English title -->
  <div class="uni-title">RAJARAJA UNIVERSITY OF SRI LANKA</div>

  <!-- Certificate number -->
  <div class="cert-number">Certificate&nbsp;#&nbsp;${certNum}</div>

  <!-- Grading scheme table -->
  <div class="grading-wrap">
    <table class="grading-table">
      <thead>
        <tr>
          <th>Grading</th>
          <th>Regulation</th>
          <th>Relevance</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>First Class</td><td>GPA &ge; 3.70</td><td>Excellent</td><td>Awarded</td></tr>
        <tr><td>Second Upper</td><td>3.30&ndash;3.69</td><td>Very Good</td><td>Awarded</td></tr>
        <tr><td>Second Lower</td><td>3.00&ndash;3.29</td><td>Good</td><td>Awarded</td></tr>
        <tr><td>Pass</td><td>2.00&ndash;2.99</td><td>Satisfactory</td><td>Awarded</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Thin divider above bilingual section -->
  <div class="divider" style="top: 106mm;"></div>

  <!-- Bilingual Sinhala / Tamil block -->
  <div class="bilingual" style="top: 109mm;">
    <!-- Sinhala column (left) -->
    <div class="col col-si">
      <div class="col-heading">ශ්‍රී ලංකා රජරට විශ්වවිද්‍යාලය</div>
      <div class="preamble">${nl2br(preambleSi)}</div>
      <div class="degree-name">${siDegree}</div>
      <div class="suffix">${nl2br(suffixSi)}</div>
      <div class="dates">${escHtml(dateSi1)}<br>${escHtml(dateSi2)}</div>
    </div>

    <!-- Tamil column (right) -->
    <div class="col col-ta">
      <div class="col-heading">இலங்கை ரஜராஜ பல்கலைக்கழகம்</div>
      <div class="preamble">${nl2br(preambleTa)}</div>
      <div class="degree-name">${taDegree}</div>
      <div class="suffix">${nl2br(suffixTa)}</div>
      <div class="dates">${escHtml(dateTa1)}<br>${escHtml(dateTa2)}</div>
    </div>
  </div>

  <!-- Thin divider above signatures -->
  <div class="divider" style="bottom: 49mm;"></div>

  <!-- Signatures + seal -->
  <div class="sig-section">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${escHtml(regName)}</div>
      <div class="sig-title">${escHtml(regTitle)}</div>
    </div>

    <div class="seal">
      <span class="seal-text">SEAL</span>
    </div>

    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${escHtml(vcName)}</div>
      <div class="sig-title">${escHtml(vcTitle)}</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ─── Front-page helpers (unchanged from original) ─────────────────────────────

function drawFrontPage(frontPage, student, layoutData, timesBold, timesRoman) {
  // 1. Student full name (centered, auto-scaled, all-caps)
  const nameText = (student.full_name || '').toUpperCase();
  let nameSize = layoutData.studentNameFontSize !== undefined ? layoutData.studentNameFontSize : 26;
  let nameWidth = timesBold.widthOfTextAtSize(nameText, nameSize);
  while (nameWidth > 481.89 && nameSize > 16) {
    nameSize -= 0.5;
    nameWidth = timesBold.widthOfTextAtSize(nameText, nameSize);
  }
  const nameX = (frontPage.getWidth() - nameWidth) / 2;
  const nameY = layoutData.studentNameY !== undefined ? layoutData.studentNameY : 490;
  frontPage.drawText(nameText, {
    x: nameX,
    y: nameY,
    size: nameSize,
    font: timesBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // 2. Degree name (centered, wrapped to max 2 lines, auto-scaled)
  const degText = (student.degree_name_en || '').toUpperCase();
  const maxDegWidth = 481.89;
  let degSize = layoutData.degreeNameFontSize !== undefined ? layoutData.degreeNameFontSize : 20;

  const buildLines = (size) => {
    const ws = degText.split(' ');
    const ls = [];
    let cur = '';
    for (const w of ws) {
      const test = cur ? `${cur} ${w}` : w;
      if (timesBold.widthOfTextAtSize(test, size) > maxDegWidth) {
        ls.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) ls.push(cur);
    return ls;
  };

  let degLines = buildLines(degSize);
  while (degLines.length > 2 && degSize > 12) {
    degSize -= 1;
    degLines = buildLines(degSize);
  }

  const degreeY = layoutData.degreeNameY !== undefined ? layoutData.degreeNameY : 405;
  let curY = degLines.length === 2 ? degreeY + 10 : degreeY;
  for (const line of degLines) {
    const w = timesBold.widthOfTextAtSize(line, degSize);
    frontPage.drawText(line, {
      x: (frontPage.getWidth() - w) / 2,
      y: curY,
      size: degSize,
      font: timesBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    curY -= (degSize + 5);
  }

  // 3. Conferment dates
  const dateDigital = layoutData.dateDigitalText || '15th January 2023';
  const line1Text = `on ${dateDigital}`;
  const line1Width = timesRoman.widthOfTextAtSize(line1Text, 12);
  const dateDigitalY = layoutData.dateDigitalY !== undefined ? layoutData.dateDigitalY : 350;
  frontPage.drawText(line1Text, {
    x: (frontPage.getWidth() - line1Width) / 2,
    y: dateDigitalY,
    size: 12,
    font: timesRoman,
    color: rgb(0.15, 0.15, 0.15),
  });

  const dateWords = layoutData.dateVerbalText || 'Twenty Seventh Day of July in the Year Two Thousand Twenty Three';
  const line5Text = `held on ${dateWords}`;
  const line5Width = timesRoman.widthOfTextAtSize(line5Text, 12);
  const dateVerbalY = layoutData.dateVerbalY !== undefined ? layoutData.dateVerbalY : 245;
  frontPage.drawText(line5Text, {
    x: (frontPage.getWidth() - line5Width) / 2,
    y: dateVerbalY,
    size: 12,
    font: timesRoman,
    color: rgb(0.15, 0.15, 0.15),
  });
}

// ─── Main worker entry point ──────────────────────────────────────────────────

async function generate() {
  let browser = null;
  try {
    const { students, outputPath, templateDir, layoutData = {} } = workerData;

    // Load FRONT templates only (back pages are generated fresh via Puppeteer)
    const templates = {
      internal_front: await PDFDocument.load(
        fs.readFileSync(path.join(templateDir, 'internal_front.pdf'))
      ),
      external_front: await PDFDocument.load(
        fs.readFileSync(path.join(templateDir, 'external_front.pdf'))
      ),
    };

    // Read font files and encode as base64 data-URLs for HTML embedding
    const fontSiPath = path.join(templateDir, 'AbhayaLibre-Regular.ttf');
    const fontTaPath = path.join(templateDir, 'Pavanam-Regular.ttf');
    const logoPath   = path.join(templateDir, 'RUSL.png');

    const fontSiBase64 = fs.existsSync(fontSiPath)
      ? toBase64DataUrl(fontSiPath, 'font/truetype') : null;
    const fontTaBase64 = fs.existsSync(fontTaPath)
      ? toBase64DataUrl(fontTaPath, 'font/truetype') : null;
    const logoBase64 = fs.existsSync(logoPath)
      ? toBase64DataUrl(logoPath, 'image/png') : null;

    // Create master PDF and embed fonts for FRONT page (English only)
    const masterDoc = await PDFDocument.create();
    const timesBold  = await masterDoc.embedFont(StandardFonts.TimesRomanBold);
    const timesRoman = await masterDoc.embedFont(StandardFonts.TimesRoman);

    // Load puppeteer via dynamic import (it is a pure-ESM package)
    const { default: puppeteer } = await import('puppeteer');

    // Launch a single Puppeteer browser instance reused for all back pages
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    let processedCount = 0;

    for (const student of students) {
      const isInternal = student.degree_type === 'Internal';
      const frontTemplate = isInternal
        ? templates.internal_front
        : templates.external_front;

      // ── Front page (pdf-lib, English) ────────────────────────────────────
      const [frontPage] = await masterDoc.copyPages(frontTemplate, [0]);
      masterDoc.addPage(frontPage);
      drawFrontPage(frontPage, student, layoutData, timesBold, timesRoman);

      // ── Back page (Puppeteer, Sinhala + Tamil) ───────────────────────────
      const html = buildBackPageHtml({
        student,
        layoutData,
        fontSiBase64,
        fontTaBase64,
        logoBase64,
      });

      const ppPage = await browser.newPage();
      // Disable cache; load embedded content only
      await ppPage.setCacheEnabled(false);
      await ppPage.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });

      const backPdfBytes = await ppPage.pdf({
        width: '210mm',
        height: '297mm',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      });

      await ppPage.close();

      // Load the Puppeteer-rendered single-page PDF and copy into master
      const backDoc = await PDFDocument.load(backPdfBytes);
      const [backPage] = await masterDoc.copyPages(backDoc, [0]);
      masterDoc.addPage(backPage);

      processedCount++;
      if (parentPort) {
        parentPort.postMessage({
          type: 'progress',
          current: processedCount,
          total: students.length,
        });
      }
    }

    await browser.close();
    browser = null;

    // Write final master PDF
    const masterBytes = await masterDoc.save();
    fs.writeFileSync(outputPath, masterBytes);

    if (parentPort) {
      parentPort.postMessage({ type: 'done', outputPath, count: processedCount });
    }
  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
    if (parentPort) {
      parentPort.postMessage({ type: 'error', error: err.stack || err.message });
    }
  }
}

generate();
