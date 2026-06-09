const fs = require('fs');
const path = require('path');

function patchFontkit() {
  try {
    const fontkitDir = path.join(process.cwd(), 'node_modules', '@pdf-lib', 'fontkit');
    if (!fs.existsSync(fontkitDir)) {
      console.log('Fontkit folder not found.');
      return;
    }

    const replaceInFile = (filePath) => {
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

    const walk = (dir) => {
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
    console.log('Fontkit patch completed.');
  } catch (err) {
    console.error('Failed to patch fontkit dynamically:', err.message);
  }
}

patchFontkit();
