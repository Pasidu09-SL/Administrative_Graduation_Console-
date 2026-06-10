const { parentPort, workerData } = require('worker_threads');
require('regenerator-runtime/runtime');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkitModule = require('@pdf-lib/fontkit');
const fontkit = fontkitModule.default || fontkitModule;
const fs = require('fs');
const path = require('path');

async function generate() {
  try {
    const { students, outputPath, templateDir } = workerData;

    // Load templates ONCE
    const templates = {
      internal_front: await PDFDocument.load(fs.readFileSync(path.join(templateDir, 'internal_front.pdf'))),
      internal_back: await PDFDocument.load(fs.readFileSync(path.join(templateDir, 'internal_back.pdf'))),
      external_front: await PDFDocument.load(fs.readFileSync(path.join(templateDir, 'external_front.pdf'))),
      external_back: await PDFDocument.load(fs.readFileSync(path.join(templateDir, 'external_back.pdf')))
    };

    // Load TrueType Fonts for Sinhala and Tamil rendering
    const fontSiBytes = fs.readFileSync(path.join(templateDir, 'AbhayaLibre-Regular.ttf'));
    const fontTaBytes = fs.readFileSync(path.join(templateDir, 'Pavanam-Regular.ttf'));

    // Create a new master PDF document and register shaper once
    const masterDoc = await PDFDocument.create();
    masterDoc.registerFontkit(fontkit);

    // Embed fonts ONCE in the master document
    const timesBold = await masterDoc.embedFont(StandardFonts.TimesRomanBold);
    const timesRoman = await masterDoc.embedFont(StandardFonts.TimesRoman);
    const timesItalic = await masterDoc.embedFont(StandardFonts.TimesRomanItalic);
    const fontSi = await masterDoc.embedFont(fontSiBytes);
    const fontTa = await masterDoc.embedFont(fontTaBytes);

    let processedCount = 0;

    for (const student of students) {
      const isInternal = student.degree_type === 'Internal';
      const frontTemplate = isInternal ? templates.internal_front : templates.external_front;
      const backTemplate = isInternal ? templates.internal_back : templates.external_back;

      // Copy pages to master document
      const [frontPage] = await masterDoc.copyPages(frontTemplate, [0]);
      const [backPage] = await masterDoc.copyPages(backTemplate, [0]);

      // Add cloned template pages to the master document
      masterDoc.addPage(frontPage);
      masterDoc.addPage(backPage);

      // ----------------------------------------------------
      // FRONT PAGE (English layout)
      // ----------------------------------------------------

      // 1. Draw dynamic student full name centered (with auto-scaling, All Caps, single-line)
      const nameText = (student.full_name || '').toUpperCase();
      let nameSize = 26;
      let nameWidth = timesBold.widthOfTextAtSize(nameText, nameSize);
      while (nameWidth > 481.89 && nameSize > 16) {
        nameSize -= 0.5;
        nameWidth = timesBold.widthOfTextAtSize(nameText, nameSize);
      }
      const nameX = (frontPage.getWidth() - nameWidth) / 2;
      frontPage.drawText(nameText, {
        x: nameX,
        y: 490,
        size: nameSize,
        font: timesBold,
        color: rgb(0.1, 0.1, 0.1)
      });

      // 2. Draw dynamic degree name centered (with auto-scaling & wrapping, max 2 lines)
      const degText = (student.degree_name_en || '').toUpperCase();
      const maxDegWidth = 481.89;
      let degSize = 20;

      // Wrap words
      const words = degText.split(' ');
      let lines = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = timesBold.widthOfTextAtSize(testLine, degSize);
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

      // If we have more than 2 lines, scale down the font size
      while (lines.length > 2 && degSize > 12) {
        degSize -= 1;
        lines = [];
        currentLine = '';
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const width = timesBold.widthOfTextAtSize(testLine, degSize);
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

      // Draw the degree lines
      let currentY = lines.length === 2 ? 415 : 405;
      for (const line of lines) {
        const w = timesBold.widthOfTextAtSize(line, degSize);
        frontPage.drawText(line, {
          x: (frontPage.getWidth() - w) / 2,
          y: currentY,
          size: degSize,
          font: timesBold,
          color: rgb(0.1, 0.1, 0.1)
        });
        currentY -= (degSize + 5);
      }

      // 3. Draw conferment details dates
      const dateDigital = "15th January 2023";
      const line1Text = `on ${dateDigital}`;
      const line1Width = timesRoman.widthOfTextAtSize(line1Text, 12);
      frontPage.drawText(line1Text, {
        x: (frontPage.getWidth() - line1Width) / 2,
        y: 350,
        size: 12,
        font: timesRoman,
        color: rgb(0.15, 0.15, 0.15)
      });

      const dateWords = "Twenty Seventh Day of July in the Year Two Thousand Twenty Three";
      const line5Text = `held on ${dateWords}`;
      const line5Width = timesRoman.widthOfTextAtSize(line5Text, 12);
      frontPage.drawText(line5Text, {
        x: (frontPage.getWidth() - line5Width) / 2,
        y: 245,
        size: 12,
        font: timesRoman,
        color: rgb(0.15, 0.15, 0.15)
      });

      // ----------------------------------------------------
      // BACK PAGE (Sinhala / Tamil translation layout)
      // ----------------------------------------------------

      // 1. Draw dynamic certificate number
      backPage.drawText(`Certificate # ${student.certificate_number}`, {
        x: 430,
        y: 735,
        size: 9,
        font: timesBold,
        color: rgb(0.1, 0.1, 0.1)
      });

      // 2. Draw dynamic mock 1D barcode pattern
      const barcodeXStart = 410;
      const barcodeYStart = 750;
      const barcodeHeight = 25;
      let currentX = barcodeXStart;
      const pattern = [1, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2];
      for (let i = 0; i < pattern.length; i++) {
        const barWidth = pattern[i];
        if (i % 2 === 0) {
          backPage.drawRectangle({
            x: currentX,
            y: barcodeYStart,
            width: barWidth,
            height: barcodeHeight,
            color: rgb(0.1, 0.1, 0.1)
          });
        }
        currentX += barWidth + (i % 3 === 0 ? 2 : 1);
      }

      // Helper function to wrap and draw short dynamic text (like degree names) in columns
      function drawDynamicColumnText(page, text, font, size, xLeft, xRight, yStart, lineGap = 4) {
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
            x: xLeft + (maxW - font.widthOfTextAtSize(line, size)) / 2, // Centered inside column
            y: currentY,
            font: font,
            size: size,
            color: rgb(0.1, 0.1, 0.1)
          });
          currentY -= (size + lineGap);
        }
        return currentY;
      }

      // 3. Draw Section B multi-lingual statutory text (side-by-side)
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
      
      // Draw Pre-wrapped Sinhala preamble
      const preambleSiLines = isInternalCand
        ? [
            "මෙම විශ්වවිද්‍යාලයේ අභ්‍යන්තර අපේක්ෂකයෙකු ලෙස",
            "නියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක",
            "ලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම",
            "සඳහන් අය වෙත"
          ]
        : [
            "මෙම විශ්වවිද්‍යාලයේ බාහිර අපේක්ෂකයෙකු ලෙස",
            "නියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක",
            "ලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම",
            "සඳහන් අය වෙත"
          ];

      let nextYSi = 482;
      for (const line of preambleSiLines) {
        backPage.drawText(line, {
          x: 45,
          y: nextYSi,
          font: fontSi,
          size: 9,
          color: rgb(0.15, 0.15, 0.15)
        });
        nextYSi -= 13;
      }

      const siDegreeText = student.degree_name_si || '';
      nextYSi -= 3;
      nextYSi = drawDynamicColumnText(backPage, siDegreeText, fontSi, 11, 45, 275, nextYSi, 4);

      nextYSi -= 2;
      const suffixSi = "පිරිනමන ලද බව මෙයින් සහතික කරමු.";
      backPage.drawText(suffixSi, {
        x: 45,
        y: nextYSi,
        font: fontSi,
        size: 9,
        color: rgb(0.15, 0.15, 0.15)
      });
      nextYSi -= 13;

      nextYSi -= 5;
      const dateSi1 = "වලංගු වීමේ දිනය: 15/01/2023";
      const dateSi2 = "උපාධි ප්‍රදානෝත්සවය: 2023 ජූලි මස 27";
      backPage.drawText(dateSi1, { x: 45, y: nextYSi, font: fontSi, size: 8, color: rgb(0.3, 0.3, 0.3) });
      nextYSi -= 11;
      backPage.drawText(dateSi2, { x: 45, y: nextYSi, font: fontSi, size: 8, color: rgb(0.3, 0.3, 0.3) });

      // Tamil Column
      const colTaCenter = 320 + (550 - 320) / 2;
      const titleTa = "இலங்கை ரஜராஜ பல்கலைக்கழகம்";
      const titleTaW = fontTa.widthOfTextAtSize(titleTa, 11);
      backPage.drawText(titleTa, {
        x: colTaCenter - titleTaW / 2,
        y: 500,
        font: fontTa,
        size: 11,
        color: rgb(0.1, 0.1, 0.1)
      });

      // Draw Pre-wrapped Tamil preamble
      const preambleTaLines = isInternalCand
        ? [
            "இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட உள்வாரி கற்கை",
            "நெறிகளையும் பரீட்சைகளையும் வெற்றிகரமாக",
            "நிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்",
            "மறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு"
          ]
        : [
            "இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட வெளிவாரி கற்கை",
            "நெறிகளையும் பரீட்சைகளையும் வெற்றிகரமாக",
            "நிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்",
            "மறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு"
          ];

      let nextYTa = 482;
      for (const line of preambleTaLines) {
        backPage.drawText(line, {
          x: 320,
          y: nextYTa,
          font: fontTa,
          size: 9,
          color: rgb(0.15, 0.15, 0.15)
        });
        nextYTa -= 13;
      }

      const taDegreeText = student.degree_name_ta || '';
      nextYTa -= 3;
      nextYTa = drawDynamicColumnText(backPage, taDegreeText, fontTa, 10, 320, 550, nextYTa, 4);

      nextYTa -= 2;
      const suffixTaLines = [
        "வழங்கப்பட்டதென இத்தால்",
        "உறுதிப்படுத்துகின்றோம்."
      ];
      for (const line of suffixTaLines) {
        backPage.drawText(line, {
          x: 320,
          y: nextYTa,
          font: fontTa,
          size: 9,
          color: rgb(0.15, 0.15, 0.15)
        });
        nextYTa -= 13;
      }

      nextYTa -= 5;
      const dateTa1 = "செல்லுபடியாகும் திகதி: 15/01/2023";
      const dateTa2 = "பட்டமளிப்பு விழா: 27 ஜூலை 2023";
      backPage.drawText(dateTa1, { x: 320, y: nextYTa, font: fontTa, size: 8, color: rgb(0.3, 0.3, 0.3) });
      nextYTa -= 11;
      backPage.drawText(dateTa2, { x: 320, y: nextYTa, font: fontTa, size: 8, color: rgb(0.3, 0.3, 0.3) });

      // 4. Draw reverse side signature names/labels
      const regNameBack = "එස්.සී. හේරත් / எஸ்.சி.ஹேரத்";
      const regTitleBack = "ලේඛකාධිකාරි / பதிவாளர்";
      const regNameW = fontSi.widthOfTextAtSize(regNameBack, 8);
      backPage.drawText(regNameBack, {
        x: 99.213 - (regNameW / 2),
        y: 118,
        font: fontSi,
        size: 8,
        color: rgb(0.2, 0.2, 0.2)
      });
      const regTitleW = fontSi.widthOfTextAtSize(regTitleBack, 8);
      backPage.drawText(regTitleBack, {
        x: 99.213 - (regTitleW / 2),
        y: 106,
        font: fontSi,
        size: 8,
        color: rgb(0.2, 0.2, 0.2)
      });

      const vcNameBack = "වෛද්‍ය පී.එච්.ජී.ජේ. පුෂ්පකුමාර / வைத்தியர் பி.எச்.ஜி.ஜே. புஷ்பகுமார";
      const vcTitleBack = "වැඩ බලන උපකුලපති / பதில் உபவேந்தர்";
      const vcNameW = fontSi.widthOfTextAtSize(vcNameBack, 7.5);
      backPage.drawText(vcNameBack, {
        x: 496.063 - (vcNameW / 2),
        y: 118,
        font: fontSi,
        size: 7.5,
        color: rgb(0.2, 0.2, 0.2)
      });
      const vcTitleW = fontSi.widthOfTextAtSize(vcTitleBack, 8);
      backPage.drawText(vcTitleBack, {
        x: 496.063 - (vcTitleW / 2),
        y: 106,
        font: fontSi,
        size: 8,
        color: rgb(0.2, 0.2, 0.2)
      });

      processedCount++;
      if (parentPort) {
        parentPort.postMessage({ type: 'progress', current: processedCount, total: students.length });
      }
    }

    // Save final Master PDF
    const masterBytes = await masterDoc.save();
    fs.writeFileSync(outputPath, masterBytes);

    if (parentPort) {
      parentPort.postMessage({ type: 'done', outputPath, count: processedCount });
    }
  } catch (err) {
    if (parentPort) {
      parentPort.postMessage({ type: 'error', error: err.stack || err.message });
    }
  }
}

generate();
