const { parentPort, workerData } = require('worker_threads');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DEFAULT_CERT_LINES = {
  internalFront: [
    { id: "f-univ", text: "RAJARATA UNIVERSITY OF SRI LANKA", fontSize: 20, fontFamily: "Times New Roman", bold: true, alignment: "center" },
    { id: "f-preamble", text: "Having successfully completed the prescribed\ncourses of study and the examinations\nof this university as an internal candidate", fontSize: 11, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-student-name", text: "", fontSize: 14, bold: true, fontFamily: "Monotype Corsiva", alignment: "center" },
    { id: "f-admitted", text: "was admitted to the degree of", fontSize: 11, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-degree", text: "", fontSize: 14, fontFamily: "Times New Roman", bold: true, alignment: "center" },
    { id: "f-on", text: "on", fontSize: 11, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-date-digital", text: "15th January 2023", fontSize: 12, fontFamily: "Times New Roman", bold: true, italic: true, alignment: "center" },
    { id: "f-and", text: "and", fontSize: 11, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-conv", text: "was conferred this degree at the", fontSize: 11, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-convocation", text: "CONVOCATION", fontSize: 11, fontFamily: "Times New Roman", bold: true, alignment: "center" },
    { id: "f-held-on", text: "held on", fontSize: 11, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-date-verbal", text: "Twenty Seventh Day of July in the Year Two Thousand Twenty Three", fontSize: 12, fontFamily: "Monotype Corsiva", bold: true, italic: true, alignment: "center" },
    { id: "f-reg-title", text: "Registrar", fontSize: 10, fontFamily: "Times New Roman", bold: true, alignment: "left" },
    { id: "f-vc-title", text: "Acting Vice Chancellor", fontSize: 10, fontFamily: "Times New Roman", bold: true, alignment: "right" }
  ],
  externalFront: [
    { id: "f-univ", text: "RAJARATA UNIVERSITY OF SRI LANKA", fontSize: 20, fontFamily: "Times New Roman", bold: true, alignment: "center" },
    { id: "f-preamble", text: "Having successfully completed the prescribed\ncourses of study and the examinations\nof this university as an external candidate", fontSize: 12, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-student-name", text: "", fontSize: 14, bold: true, fontFamily: "Monotype Corsiva", alignment: "center" },
    { id: "f-admitted", text: "was admitted to the degree of", fontSize: 11, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-degree", text: "", fontSize: 14, fontFamily: "Times New Roman", bold: true, alignment: "center" },
    { id: "f-on", text: "on", fontSize: 11, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-date-digital", text: "15th January 2023", fontSize: 12, fontFamily: "Times New Roman", bold: true, italic: true, alignment: "center" },
    { id: "f-and", text: "and", fontSize: 11, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-conv", text: "was conferred this degree at the", fontSize: 11, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-convocation", text: "CONVOCATION", fontSize: 11, fontFamily: "Times New Roman", bold: true, alignment: "center" },
    { id: "f-held-on", text: "held on", fontSize: 11, fontFamily: "Lucida Calligraphy", italic: true, alignment: "center" },
    { id: "f-date-verbal", text: "Twenty Seventh Day of July in the Year Two Thousand Twenty Three", fontSize: 12, fontFamily: "Monotype Corsiva", bold: true, italic: true, alignment: "center" },
    { id: "f-reg-title", text: "Registrar", fontSize: 10, fontFamily: "Times New Roman", bold: true, alignment: "left" },
    { id: "f-vc-title", text: "Acting Vice Chancellor", fontSize: 10, fontFamily: "Times New Roman", bold: true, alignment: "right" }
  ],
  internalBack: [
    { id: "b-barcode", text: "", fontSize: 7, alignment: "right" },
    { id: "b-si-univ", text: "ශ්‍රී ලංකා රජරට විශ්වවිද්‍යාලය", fontSize: 20, bold: true, fontFamily: "Abhaya Libre", alignment: "center" },
    { id: "b-si-preamble", text: "මෙම විශ්වවිද්‍යාලයේ අභ්‍යන්තර අපේක්ෂකයෙකු ලෙස\nනියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක ලෙස නිම කිරීමෙන් පසු\nමෙහි පසු පිටේ නම සඳහන් අය වෙත", fontSize: 12, fontFamily: "Abhaya Libre", alignment: "center" },
    { id: "b-si-date", text: "2023 ජූලි මස 27 වන දින", fontSize: 12, bold: true, italic: true, fontFamily: "Abhaya Libre", alignment: "center" },
    { id: "b-si-conv", text: "පවත්වන ලද උපාධි ප්‍රදානෝත්සවයේදී", fontSize: 12, fontFamily: "Abhaya Libre", alignment: "center" },
    { id: "b-si-date2", text: "දින සිට", fontSize: 12, bold: true, italic: true, fontFamily: "Abhaya Libre", alignment: "center" },
    { id: "b-si-degree", text: "", fontSize: 13, bold: true, fontFamily: "Abhaya Libre", alignment: "center" },
    { id: "b-si-suffix", text: "පිරිනමන ලද බව මෙයින් සහතික කරමු.", fontSize: 12, fontFamily: "Abhaya Libre", alignment: "center" },
    { id: "b-si-reg-name", text: "එස්.සී. හේරත්", fontSize: 10, fontFamily: "Abhaya Libre", bold: true, alignment: "left" },
    { id: "b-si-reg-title", text: "ලේඛකාධිකාරි", fontSize: 9, fontFamily: "Abhaya Libre", alignment: "left" },
    { id: "b-si-vc-name", text: "වෛද්‍ය පී.එච්.ජේ. පුෂ්පකුමාර", fontSize: 10, fontFamily: "Abhaya Libre", bold: true, alignment: "right" },
    { id: "b-si-vc-title", text: "වැඩ බලන උපකුලපති", fontSize: 9, fontFamily: "Abhaya Libre", alignment: "right" },
    { id: "b-ta-univ", text: "இலங்கை ரஜராஜ பல்கலைக்கழகம்", fontSize: 18, bold: true, fontFamily: "Pavanam", alignment: "center" },
    { id: "b-ta-preamble", text: "இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட உள்வாரி கற்கை நெறிகளையும்", fontSize: 12, fontFamily: "Pavanam", alignment: "center" },
    { id: "b-ta-date1", text: "27 ஜூன் 2023", fontSize: 12, bold: true, italic: true, fontFamily: "Pavanam", alignment: "center" },
    { id: "b-ta-cont", text: "நிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்", fontSize: 12, fontFamily: "Pavanam", alignment: "center" },
    { id: "b-ta-degree", text: "", fontSize: 13, bold: true, fontFamily: "Pavanam", alignment: "center" },
    { id: "b-ta-date2", text: "27 ஜூலை 2023", fontSize: 12, bold: true, italic: true, fontFamily: "Pavanam", alignment: "center" },
    { id: "b-ta-cont2", text: "பரீட்சைகளையும் வெற்றிகரமாக மறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு", fontSize: 12, fontFamily: "Pavanam", alignment: "center" },
    { id: "b-ta-suffix", text: "வழங்கப்பட்டதென இத்தால்\nஉறுதிப்படுத்துகின்றோம்.", fontSize: 12, fontFamily: "Pavanam", alignment: "center" },
    { id: "b-ta-reg-name", text: "எஸ்.சி.ஹேரத்", fontSize: 10, fontFamily: "Pavanam", bold: true, alignment: "left" },
    { id: "b-ta-reg-title", text: "பதிவாளர்", fontSize: 9, fontFamily: "Pavanam", alignment: "left" },
    { id: "b-ta-vc-name", text: "வைத்தியர் பி.எச்.ஜி.ஜே. புஷ்பகுமார", fontSize: 10, fontFamily: "Pavanam", bold: true, alignment: "right" },
    { id: "b-ta-vc-title", text: "பதில் உபவேந்தர்", fontSize: 9, fontFamily: "Pavanam", alignment: "right" }
  ],
  externalBack: [
    { id: "b-barcode", text: "", fontSize: 7, alignment: "right" },
    { id: "b-ta-vc-name", text: "வைத்தியர் பி.எச்.ஜி.ஜே. புஷ்பகுமார", fontSize: 7.5, fontFamily: "Pavanam", alignment: "right" },
    { id: "b-ta-vc-title", text: "பதில் உபவேந்தர்", fontSize: 7, fontFamily: "Pavanam", alignment: "right" }
  ]
};

const DEFAULT_Y_MAP = {
  // Front page
  "f-univ": 610,
  "f-preamble": 570,
  "f-student-name": 505,
  "f-admitted": 460,
  "f-degree": 435,
  "f-on": 400,
  "f-date-digital": 380,
  "f-and": 350,
  "f-conv": 320,
  "f-convocation": 290,
  "f-held-on": 260,
  "f-date-verbal": 230,
  "f-reg-name": 70,
  "f-reg-title": 60,
  "f-vc-name": 70,
  "f-vc-title": 60,

  // Back page
  "b-barcode": 780,
  "b-si-univ": 710,
  "b-si-preamble": 670,
  "b-si-date": 610,
  "b-si-conv": 587,
  "b-si-date2": 560,
  "b-si-degree": 530,
  "b-si-suffix": 500,
  "b-si-reg-name": 440,
  "b-si-reg-title": 425,
  "b-si-vc-name": 440,
  "b-si-vc-title": 425 ,
  "b-ta-univ": 338,
  "b-ta-preamble": 315,
  "b-ta-date1": 290,
  "b-ta-cont": 265,
  "b-ta-degree": 240,
  "b-ta-date2": 215,
  "b-ta-cont2": 190,
  "b-ta-suffix": 160,
  "b-ta-reg-name": 60,
  "b-ta-reg-title": 45,
  "b-ta-vc-name": 60,
  "b-ta-vc-title": 45
};

function getStudentCertLines(layoutData, isInternal, side) {
  const key = isInternal 
    ? (side === 'front' ? 'internalFront' : 'internalBack')
    : (side === 'front' ? 'externalFront' : 'externalBack');
    
  const defaults = DEFAULT_CERT_LINES[key];
  
  // Apply manual overrides from flat properties in layoutData if present
  const baseLines = defaults.map(line => {
    const dbKey = line.id.replace(/-/g, '_');
    if (layoutData && layoutData[dbKey] !== undefined && layoutData[dbKey] !== null) {
      return { ...line, text: layoutData[dbKey] };
    }
    return line;
  });

  const saved = (layoutData && layoutData.certLines) ? layoutData.certLines[key] : null;
  if (!saved) return baseLines;
  
  return baseLines.map(def => {
    const found = saved.find(s => s.id === def.id);
    if (found) {
      const dbKey = def.id.replace(/-/g, '_');
      const textOverride = (layoutData && layoutData[dbKey] !== undefined && layoutData[dbKey] !== null)
        ? layoutData[dbKey]
        : (found.text !== undefined ? found.text : def.text);
      return { ...def, ...found, text: textOverride };
    }
    return def;
  });
}

function renderHtmlLines(lines, student, layoutData, side) {
  let html = '';
  const SCALE = 1.24;
  
  for (const line of lines) {
    let text = line.text;
    let isStudentName = false;
    let isDegreeName = false;
    if (line.id === "f-student-name") {
      text = (student.full_name || '').toUpperCase();
      isStudentName = true;
    } else if (line.id === "f-degree") {
      text = (student.degree_name_en || '').toUpperCase();
      isDegreeName = true;
    } else if (line.id === "b-si-degree") {
      text = student.degree_name_si || '';
    } else if (line.id === "b-ta-degree") {
      text = student.degree_name_ta || '';
    }
    
    if (line.id === "f-logo-space" || line.id === "f-seal-space" || line.id === "b-logo-space") {
      continue;
    }
    
    const yOffsetPx = typeof line.yOffsetPx === 'number' ? line.yOffsetPx : 0;
    const defaultY = DEFAULT_Y_MAP[line.id] || 400;
    const pdfY = defaultY - (yOffsetPx * SCALE);
    const top = 841.89 - pdfY;
    
    const alignment = line.alignment || "center";
    let columnCenterX = 297.6375;
    if (alignment === "left") {
      columnCenterX = 114.545;
    } else if (alignment === "right") {
      columnCenterX = 480.725;
    }
    
    let maxW = 490;
    if (alignment === "left" || alignment === "right") {
      maxW = 150;
    }
    
    const fontFamily = line.fontFamily || "Times New Roman";
    const bold = !!line.bold;
    const italic = !!line.italic;
    const fontSize = typeof line.fontSize === 'number' ? line.fontSize : 9;
    const size = fontSize * SCALE;
    
    if (line.id === "b-barcode") {
      const certNo = student.certificate_number || '000000';
      const barcodeWidth = (certNo.length * 11 + 37) * 0.9;
      const barcodeXStart = 555.275 - barcodeWidth - 10;
      
      html += `
        <div style="
          position: absolute;
          left: ${barcodeXStart}pt;
          top: ${top}pt;
          width: ${barcodeWidth}pt;
          display: flex;
          flex-direction: column;
          align-items: center;
        ">
          <canvas id="barcode-${student.id}" class="barcode-canvas" data-text="${certNo}" width="${barcodeWidth}" height="22"></canvas>
          <span style="font-family: 'Times New Roman', serif; font-weight: bold; font-size: 7.5pt; margin-top: 2pt; color: #1a1a1a;">${certNo}</span>
        </div>
      `;
    } else {
      const signatureLines = [
        "f-reg-name", "f-vc-name", 
        "b-si-reg-name", "b-si-vc-name", 
        "b-ta-reg-name", "b-ta-vc-name"
      ];
      if (signatureLines.includes(line.id) && side === 'front') {
        html += `
          <div class="sig-line" style="
            left: ${columnCenterX}pt;
            top: ${841.89 - (pdfY + 22)}pt;
          "></div>
        `;
      }
      
      let cssFont = 'Times New Roman';
      if (fontFamily.includes("Abhaya Libre")) {
        cssFont = "'Abhaya Libre', serif";
      } else if (fontFamily.includes("Pavanam")) {
        cssFont = "'Pavanam', sans-serif";
      } else if (fontFamily.includes("Lucida Calligraphy")) {
        cssFont = "'Lucida Calligraphy', cursive";
      } else if (fontFamily.includes("Monotype Corsiva")) {
        cssFont = "'Monotype Corsiva', cursive";
      }
      
      const fontWeight = bold ? 'bold' : 'normal';
      const fontStyle = italic ? 'italic' : 'normal';
      const formattedText = (text || '').replace(/\n/g, '<br>');
      
      let extraClass = '';
      if (isStudentName) {
        extraClass = ' cert-student-name';
      } else if (isDegreeName) {
        extraClass = ' cert-degree-name';
      }
      
      html += `
        <div class="line${extraClass}" style="
          left: ${columnCenterX}pt;
          top: ${top}pt;
          width: ${maxW}pt;
          font-family: ${cssFont};
          font-size: ${size}pt;
          font-weight: ${fontWeight};
          font-style: ${fontStyle};
          color: #1a1a1a;
        ">${formattedText}</div>
      `;
    }
  }
  return html;
}

async function generate() {
  try {
    const { students, outputPath, templateDir, layoutData = {} } = workerData;

    // Load TrueType Fonts for Sinhala and Tamil rendering
    const fontSiBytes = fs.readFileSync(path.join(templateDir, 'AbhayaLibre-Regular.ttf'));
    const fontTaBytes = fs.readFileSync(path.join(templateDir, 'Pavanam-Regular.ttf'));

    const fontSiBase64 = fontSiBytes.toString('base64');
    const fontTaBase64 = fontTaBytes.toString('base64');

    // Build the master HTML content for all pages
    let htmlContent = `
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
  size: 595.275pt 841.89pt;
  margin: 0;
}
body {
  margin: 0;
  padding: 0;
  background-color: white;
  -webkit-print-color-adjust: exact;
}
.page {
  position: relative;
  width: 595.275pt;
  height: 841.89pt;
  box-sizing: border-box;
  page-break-after: always;
  overflow: hidden;
}
.outer-border {
  position: absolute;
  top: 20pt;
  left: 20pt;
  right: 20pt;
  bottom: 20pt;
  border: 1.5pt solid #262626;
  box-sizing: border-box;
}
.inner-border {
  position: absolute;
  top: 23pt;
  left: 23pt;
  right: 23pt;
  bottom: 23pt;
  border: 0.5pt solid #262626;
  box-sizing: border-box;
}
.line {
  position: absolute;
  transform: translate(-50%, -0.85em);
  text-align: center;
  line-height: 1.25;
}
.sig-line {
  position: absolute;
  height: 0.75pt;
  background-color: #333;
  transform: translateX(-50%);
  width: 120pt;
}
</style>
</head>
<body>
`;

    let processedCount = 0;

    for (const student of students) {
      const isInternal = student.degree_type === 'Internal';

      // 1. Render front page
      const frontLines = getStudentCertLines(layoutData, isInternal, 'front');
      htmlContent += `<div class="page">`;
      htmlContent += `  <div class="outer-border"></div>`;
      htmlContent += `  <div class="inner-border"></div>`;
      htmlContent += renderHtmlLines(frontLines, student, layoutData, 'front');
      htmlContent += `</div>`;

      // 2. Render back page
      const backLines = getStudentCertLines(layoutData, isInternal, 'back');
      htmlContent += `<div class="page">`;
      htmlContent += `  <div class="outer-border"></div>`;
      htmlContent += `  <div class="inner-border"></div>`;
      htmlContent += renderHtmlLines(backLines, student, layoutData, 'back');
      htmlContent += `</div>`;

      processedCount++;
      // Post progress updates during parsing
      if (parentPort) {
        parentPort.postMessage({ type: 'progress', current: Math.round(processedCount * 0.5), total: students.length });
      }
    }

    // Add barcode drawing script
    htmlContent += `
<script>
function drawBarcode128(canvasId, text, barHeight, scale) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const data = "212222222122222221121223121322131222122213122312132212221213221312231212112232122132122231113222123122123221223211221132221231213212223112312131311222321122321221312212322112322211212123212321232121111323131123131321112313132113132311211313231113231311112133112331132131113123113321133121313121211331231131213113213311213131311123311321331121312113312311332111314111221411431111111224111422121124121421141122141221112214112412122114122411142112142211241211221114413111241112134111111242121142121241114212124112124211411212421112421211212141214121412121111143111341131141114113114311411113411311113141114131311141411131"
    .split(/(\\d{6})/)
    .filter(Boolean);

  const lookup = {};
  for (let i = 32; i < 127; i++) {
    lookup[String.fromCharCode(i)] = [i - 32, data[i - 32]];
  }

  let x = 0;
  let sum = 104; // Start B

  function drawPattern(pattern) {
    for (let i = 0; i < pattern.length; i++) {
      const width = parseInt(pattern[i], 10) * scale;
      if (i % 2 === 0) {
        ctx.fillStyle = 'black';
        ctx.fillRect(x, 0, width, barHeight);
      }
      x += width;
    }
  }

  drawPattern("211214"); // Start B

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const val = lookup[c] || [0, ""];
    sum += val[0] * (i + 1);
    drawPattern(val[1]);
  }

  const checksumPattern = data[sum % 103];
  drawPattern(checksumPattern);

  drawPattern("2331112"); // Stop pattern

  ctx.fillStyle = 'black';
  ctx.fillRect(x, 0, 2 * scale, barHeight);
}

document.querySelectorAll('.barcode-canvas').forEach(canvas => {
  const text = canvas.getAttribute('data-text');
  const id = canvas.getAttribute('id');
  drawBarcode128(id, text, 22, 0.9);
});

// Dynamic student name and degree scaling/splitting logic
const dummy = document.createElement('div');
dummy.style.width = '490pt';
dummy.style.position = 'absolute';
dummy.style.visibility = 'hidden';
document.body.appendChild(dummy);
const maxW_px = dummy.offsetWidth;
document.body.removeChild(dummy);

function measureTextWidth(text, fontStyle) {
  const span = document.createElement('span');
  span.style.fontFamily = fontStyle.fontFamily;
  span.style.fontSize = fontStyle.fontSize;
  span.style.fontWeight = fontStyle.fontWeight;
  span.style.fontStyle = fontStyle.fontStyle;
  span.style.whiteSpace = 'nowrap';
  span.style.position = 'absolute';
  span.style.visibility = 'hidden';
  span.textContent = text;
  document.body.appendChild(span);
  const w = span.offsetWidth;
  document.body.removeChild(span);
  return w;
}

// 1. Shrink student names down to 8pt if they exceed maxW_px
document.querySelectorAll('.cert-student-name').forEach(el => {
  const origWS = el.style.whiteSpace;
  const origW = el.style.width;
  
  el.style.whiteSpace = 'nowrap';
  el.style.width = 'auto';
  
  let currentW = el.offsetWidth;
  if (currentW > maxW_px) {
    let fontSizePt = parseFloat(el.style.fontSize) || 14 * 1.24;
    const minSizePt = 8 * 1.24;
    
    while (currentW > maxW_px && fontSizePt > minSizePt) {
      fontSizePt -= 0.2;
      el.style.fontSize = fontSizePt + 'pt';
      currentW = el.offsetWidth;
    }
  }
  
  el.style.whiteSpace = origWS;
  el.style.width = origW;
});

// 2. Split or shrink degree names down to 7pt if they exceed maxW_px
document.querySelectorAll('.cert-degree-name').forEach(el => {
  const fontStyle = {
    fontFamily: el.style.fontFamily || window.getComputedStyle(el).fontFamily,
    fontSize: el.style.fontSize,
    fontWeight: el.style.fontWeight,
    fontStyle: el.style.fontStyle
  };
  
  const originalText = el.textContent.trim().replace(/\s+/g, ' ');
  let w = measureTextWidth(originalText, fontStyle);
  
  if (w > maxW_px) {
    const idx = originalText.toUpperCase().indexOf(" IN ");
    if (idx !== -1) {
      const part1 = originalText.substring(0, idx + 4);
      const part2 = originalText.substring(idx + 4).trim();
      
      el.innerHTML = part1 + '<br>' + part2;
      
      let w1 = measureTextWidth(part1, fontStyle);
      let w2 = measureTextWidth(part2, fontStyle);
      let maxLineW = Math.max(w1, w2);
      
      if (maxLineW > maxW_px) {
        let fontSizePt = parseFloat(fontStyle.fontSize) || 14 * 1.24;
        const minSizePt = 7 * 1.24;
        
        while (maxLineW > maxW_px && fontSizePt > minSizePt) {
          fontSizePt -= 0.2;
          el.style.fontSize = fontSizePt + 'pt';
          fontStyle.fontSize = fontSizePt + 'pt';
          w1 = measureTextWidth(part1, fontStyle);
          w2 = measureTextWidth(part2, fontStyle);
          maxLineW = Math.max(w1, w2);
        }
      }
    } else {
      let fontSizePt = parseFloat(fontStyle.fontSize) || 14 * 1.24;
      const minSizePt = 7 * 1.24;
      
      while (w > maxW_px && fontSizePt > minSizePt) {
        fontSizePt -= 0.2;
        el.style.fontSize = fontSizePt + 'pt';
        fontStyle.fontSize = fontSizePt + 'pt';
        w = measureTextWidth(originalText, fontStyle);
      }
    }
  }
});
</script>
</body>
</html>
`;

    // Launch headless Chromium via Puppeteer to generate final PDF
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Print to PDF
    const pdfBuffer = await page.pdf({
      width: '8.2677in',
      height: '11.6929in',
      margin: {
        top: '0px',
        bottom: '0px',
        left: '0px',
        right: '0px'
      },
      printBackground: true
    });

    await browser.close();

    // Save final PDF
    fs.writeFileSync(outputPath, pdfBuffer);

    if (parentPort) {
      parentPort.postMessage({ type: 'progress', current: students.length, total: students.length });
      parentPort.postMessage({ type: 'done', outputPath, count: students.length });
    }
  } catch (err) {
    if (parentPort) {
      parentPort.postMessage({ type: 'error', error: err.stack || err.message });
    }
  }
}

generate();
