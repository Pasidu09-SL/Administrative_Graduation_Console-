import fs from 'fs';
import path from 'path';

function main() {
  const logPath = 'C:\\Users\\thanu\\.gemini\\antigravity-ide\\brain\\43e63a36-3a62-4f7a-b8ce-f4a542d48dd7\\.system_generated\\logs\\transcript.jsonl';
  if (!fs.existsSync(logPath)) {
    console.error('Log file does not exist.');
    return;
  }

  const lines = fs.readFileSync(logPath, 'utf8').split('\n');
  let editCount = 0;
  let output = '';
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      // Look for code edits to page.tsx
      const isCodeAction = obj.type === 'CODE_ACTION';
      const isModelCodeTool = obj.tool_calls && obj.tool_calls.some((tc: any) => 
        tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content' || tc.name === 'write_to_file'
      );
      
      const containsPage = JSON.stringify(obj).toLowerCase().includes('admin/page.tsx') || JSON.stringify(obj).toLowerCase().includes('admin\\\\page.tsx');
      
      if ((isCodeAction || isModelCodeTool) && containsPage) {
        output += `\n========================================\n`;
        output += `Step Index: ${obj.step_index} (${obj.created_at})\n`;
        output += `Type: ${obj.type}\n`;
        
        if (obj.tool_calls) {
          for (const tc of obj.tool_calls) {
            if (tc.args && (tc.args.TargetFile || tc.args.Target)) {
              output += `Tool: ${tc.name}\n`;
              output += `File: ${tc.args.TargetFile || tc.args.Target}\n`;
              if (tc.args.Instruction) output += `Instruction: ${tc.args.Instruction}\n`;
              if (tc.args.ReplacementContent) {
                output += `--- Replacement Content ---\n`;
                output += tc.args.ReplacementContent + `\n`;
              }
              if (tc.args.ReplacementChunks) {
                output += `--- Replacement Chunks ---\n`;
                output += JSON.stringify(tc.args.ReplacementChunks, null, 2) + `\n`;
              }
              if (tc.args.CodeContent) {
                output += `--- Code Content ---\n`;
                output += tc.args.CodeContent + `\n`;
              }
            }
          }
        }
        
        if (!obj.tool_calls && obj.content) {
          output += `Content snippet: ${obj.content.substring(0, 1000)}\n`;
        }
        editCount++;
      }
    } catch (err: any) {
      // Ignore parse errors
    }
  }
  fs.writeFileSync('src/tests/extracted-edits.txt', output, 'utf8');
  console.log(`Found ${editCount} matching edits.`);
}

main();
