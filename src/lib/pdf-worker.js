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

    // Load background templates from public/templates
    const templates = {
      internal_front: fs.readFileSync(path.join(templateDir, 'internal_front.pdf')),
      internal_back: fs.readFileSync(path.join(templateDir, 'internal_back.pdf')),
      external_front: fs.readFileSync(path.join(templateDir, 'external_front.pdf')),
      external_back: fs.readFileSync(path.join(templateDir, 'external_back.pdf'))
    };

    // Load TrueType Fonts for Sinhala and Tamil rendering
    const fontSiBytes = fs.readFileSync(path.join(templateDir, 'AbhayaLibre-Regular.ttf'));
    const fontTaBytes = fs.readFileSync(path.join(templateDir, 'Pavanam-Regular.ttf'));

    // Create a new master PDF document
    const masterDoc = await PDFDocument.create();
    let processedCount = 0;

    for (const student of students) {
      const isInternal = student.degree_type === 'Internal';
      const frontBytes = isInternal ? templates.internal_front : templates.external_front;
      const backBytes = isInternal ? templates.internal_back : templates.external_back;

      // ----------------------------------------------------
      // FRONT PAGE (English layout)
      // ----------------------------------------------------
      const frontDoc = await PDFDocument.load(frontBytes);
      const frontFontBold = await frontDoc.embedFont(StandardFonts.HelveticaBold);

      const frontPages = frontDoc.getPages();
      const frontPage = frontPages[0];

      // 1. Erase sample name on English side (now Front Page)
      frontPage.drawRectangle({
        x: 50,
        y: 485,
        width: 495.275,
        height: 50,
        color: rgb(0.98, 0.975, 0.95)
      });

      // 2. Draw dynamic student full name centered (with auto-scaling)
      let nameSize = 18;
      let nameWidth = frontFontBold.widthOfTextAtSize(student.full_name, nameSize);
      while (nameWidth > 480 && nameSize > 10) {
        nameSize -= 0.5;
        nameWidth = frontFontBold.widthOfTextAtSize(student.full_name, nameSize);
      }
      const nameX = (frontPage.getWidth() - nameWidth) / 2;
      frontPage.drawText(student.full_name, {
        x: nameX,
        y: 500,
        size: nameSize,
        font: frontFontBold,
        color: rgb(0.1, 0.1, 0.1)
      });

      // 3. Erase sample degree on English side (now Front Page)
      frontPage.drawRectangle({
        x: 50,
        y: 425,
        width: 495.275,
        height: 35,
        color: rgb(0.98, 0.975, 0.95)
      });

      // 4. Draw dynamic degree name centered (with auto-scaling)
      const degText = (student.degree_name_en || '').toUpperCase();
      let degSize = 14;
      let degWidth = frontFontBold.widthOfTextAtSize(degText, degSize);
      while (degWidth > 480 && degSize > 8) {
        degSize -= 0.5;
        degWidth = frontFontBold.widthOfTextAtSize(degText, degSize);
      }
      const degX = (frontPage.getWidth() - degWidth) / 2;
      frontPage.drawText(degText, {
        x: degX,
        y: 435,
        size: degSize,
        font: frontFontBold,
        color: rgb(0.1, 0.1, 0.1)
      });

      const modifiedFrontBytes = await frontDoc.save();

      // ----------------------------------------------------
      // BACK PAGE (Sinhala / Tamil translation layout)
      // ----------------------------------------------------
      const backDoc = await PDFDocument.load(backBytes);
      backDoc.registerFontkit(fontkit);
      const backFontBold = await backDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSi = await backDoc.embedFont(fontSiBytes);
      const fontTa = await backDoc.embedFont(fontTaBytes);

      const backPages = backDoc.getPages();
      const backPage = backPages[0];

      // 1. Erase sample barcode and certificate serial number at top right (now Back Page)
      backPage.drawRectangle({
        x: 390,
        y: 720,
        width: 170,
        height: 90,
        color: rgb(0.98, 0.975, 0.95)
      });

      // 2. Draw dynamic certificate number
      backPage.drawText(`Certificate # ${student.certificate_number}`, {
        x: 430,
        y: 735,
        size: 9,
        font: backFontBold,
        color: rgb(0.1, 0.1, 0.1)
      });

      // 3. Draw dynamic mock 1D barcode pattern
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

      // 4. Erase old Sinhala degree name (now Back Page)
      backPage.drawRectangle({
        x: 50,
        y: 470,
        width: 495.275,
        height: 40,
        color: rgb(0.98, 0.975, 0.95)
      });

      // 5. Draw dynamic Sinhala degree name centered
      const siText = student.degree_name_si || '';
      let siSize = 16;
      let siWidth = fontSi.widthOfTextAtSize(siText, siSize);
      while (siWidth > 480 && siSize > 10) {
        siSize -= 0.5;
        siWidth = fontSi.widthOfTextAtSize(siText, siSize);
      }
      const siX = (backPage.getWidth() - siWidth) / 2;
      backPage.drawText(siText, {
        x: siX,
        y: 480,
        size: siSize,
        font: fontSi,
        color: rgb(0.1, 0.1, 0.1)
      });

      // 6. Erase old Tamil degree name (now Back Page)
      backPage.drawRectangle({
        x: 50,
        y: 300,
        width: 495.275,
        height: 40,
        color: rgb(0.98, 0.975, 0.95)
      });

      // 7. Draw dynamic Tamil degree name centered
      const taText = student.degree_name_ta || '';
      let taSize = 14;
      let taWidth = fontTa.widthOfTextAtSize(taText, taSize);
      while (taWidth > 480 && taSize > 8) {
        taSize -= 0.5;
        taWidth = fontTa.widthOfTextAtSize(taText, taSize);
      }
      const taX = (backPage.getWidth() - taWidth) / 2;
      backPage.drawText(taText, {
        x: taX,
        y: 310,
        size: taSize,
        font: fontTa,
        color: rgb(0.1, 0.1, 0.1)
      });

      const modifiedBackBytes = await backDoc.save();

      // ----------------------------------------------------
      // MERGE INTO MASTER DOCUMENT
      // ----------------------------------------------------
      const tempFrontDoc = await PDFDocument.load(modifiedFrontBytes);
      const tempBackDoc = await PDFDocument.load(modifiedBackBytes);

      const [copiedFront] = await masterDoc.copyPages(tempFrontDoc, [0]);
      const [copiedBack] = await masterDoc.copyPages(tempBackDoc, [0]);

      // Alternating duplex mapping
      masterDoc.addPage(copiedFront);
      masterDoc.addPage(copiedBack);

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
