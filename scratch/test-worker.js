require('regenerator-runtime/runtime');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');
const fontkit = fontkitModule.default || fontkitModule;
const fs = require('fs');
const path = require('path');

const student = {
  id: 'test-id',
  full_name: 'JAYAWARDHANA MUDIYANSELAGE LAKSHAN VIDURANGA JAYAWARDHANA',
  index_no: 'INDEX-260001',
  certificate_number: '23.4.221',
  degree_name_en: 'Bachelor of Business Administration',
  degree_name_si: 'ව්‍යාපාර පරිපාලනවේදී උපාධිය',
  degree_name_ta: 'வியாபார நிர்வாக இளமாணிப் பட்டம்',
  degree_type: 'External'
};

async function test() {
  console.log('Starting test...');
  const templateDir = path.join(__dirname, '..', 'public', 'templates');
  
  const templates = {
    internal_front: fs.readFileSync(path.join(templateDir, 'internal_front.pdf')),
    internal_back: fs.readFileSync(path.join(templateDir, 'internal_back.pdf')),
    external_front: fs.readFileSync(path.join(templateDir, 'external_front.pdf')),
    external_back: fs.readFileSync(path.join(templateDir, 'external_back.pdf'))
  };

  const fontSiBytes = fs.readFileSync(path.join(templateDir, 'AbhayaLibre-Regular.ttf'));
  const fontTaBytes = fs.readFileSync(path.join(templateDir, 'Pavanam-Regular.ttf'));

  const isInternal = student.degree_type === 'Internal';
  const frontBytes = isInternal ? templates.internal_front : templates.external_front;
  const backBytes = isInternal ? templates.internal_back : templates.external_back;

  console.log('Loading front PDF...');
  const frontDoc = await PDFDocument.load(frontBytes);
  const frontFontBold = await frontDoc.embedFont(StandardFonts.TimesRomanBold);
  const frontFontRoman = await frontDoc.embedFont(StandardFonts.TimesRoman);
  const frontPages = frontDoc.getPages();
  const frontPage = frontPages[0];

  console.log('Drawing front text...');
  const nameText = (student.full_name || '').toUpperCase();
  let nameSize = 26;
  let nameWidth = frontFontBold.widthOfTextAtSize(nameText, nameSize);
  while (nameWidth > 481.89 && nameSize > 16) {
    nameSize -= 0.5;
    nameWidth = frontFontBold.widthOfTextAtSize(nameText, nameSize);
  }
  const nameX = (frontPage.getWidth() - nameWidth) / 2;
  frontPage.drawText(nameText, {
    x: nameX,
    y: 490,
    size: nameSize,
    font: frontFontBold,
    color: rgb(0.1, 0.1, 0.1)
  });

  const degText = (student.degree_name_en || '').toUpperCase();
  const maxDegWidth = 481.89;
  let degSize = 20;

  const words = degText.split(' ');
  let lines = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = frontFontBold.widthOfTextAtSize(testLine, degSize);
    if (width > maxDegWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  while (lines.length > 2 && degSize > 12) {
    degSize -= 1;
    lines = [];
    currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = frontFontBold.widthOfTextAtSize(testLine, degSize);
      if (width > maxDegWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  let currentY = lines.length === 2 ? 415 : 405;
  for (const line of lines) {
    const w = frontFontBold.widthOfTextAtSize(line, degSize);
    frontPage.drawText(line, {
      x: (frontPage.getWidth() - w) / 2,
      y: currentY,
      size: degSize,
      font: frontFontBold,
      color: rgb(0.1, 0.1, 0.1)
    });
    currentY -= (degSize + 5);
  }

  console.log('Saving front doc...');
  const modifiedFrontBytes = await frontDoc.save();

  console.log('Loading back PDF...');
  const backDoc = await PDFDocument.load(backBytes);
  backDoc.registerFontkit(fontkit);
  const backFontBold = await backDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontSi = await backDoc.embedFont(fontSiBytes);
  const fontTa = await backDoc.embedFont(fontTaBytes);
  const backPages = backDoc.getPages();
  const backPage = backPages[0];

  console.log('Drawing back text...');
  backPage.drawText(`Certificate # ${student.certificate_number}`, {
    x: 430,
    y: 735,
    size: 9,
    font: backFontBold,
    color: rgb(0.1, 0.1, 0.1)
  });

  // Helper function to wrap and draw text in columns
  function drawColumnText(page, text, font, size, xLeft, xRight, yStart, lineGap = 4) {
    console.log(`drawColumnText: "${text.substring(0, 30)}..."`);
    const words = text.split(' ');
    const maxW = xRight - xLeft;
    let lines = [];
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
      page.drawText(line, {
        x: xLeft,
        y: currentY,
        font: font,
        size: size,
        color: rgb(0.15, 0.15, 0.15)
      });
      currentY -= (size + lineGap);
    }
    return currentY;
  }

  const colSiCenter = 45 + (275 - 45) / 2;
  const titleSi = "ශ්‍රී ලංකා රජරාජ විශ්වවිද්‍යාලය";
  const titleSiW = fontSi.widthOfTextAtSize(titleSi, 12);
  backPage.drawText(titleSi, {
    x: colSiCenter - titleSiW / 2,
    y: 500,
    font: fontSi,
    size: 12,
    color: rgb(0.1, 0.1, 0.1)
  });

  const isInternalCand = student.degree_type === 'Internal';
  const preambleSi = `මෙම විශ්වවිද්‍යාලයේ ${isInternalCand ? 'අභ්‍යන්තර' : 'බාහිර'} අපේක්ෂකයෙකු ලෙස නියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක ලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම සඳහන් අය වෙත`;
  let nextYSi = drawColumnText(backPage, preambleSi, fontSi, 9.5, 45, 275, 482, 4);

  console.log('Completed successfully!');
}

test().catch(err => {
  console.error('Test failed:', err);
});
