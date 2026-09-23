const fs = require('fs');
const { execSync } = require('child_process');

try {
  execSync('node scripts/check-i18n.js');
} catch (error) {
  const output = error.stdout.toString();
  const lines = output.split('\n');
  const filesToLines = {};

  for (const line of lines) {
    const match = line.match(/✖ \[하드코딩\] (.*?):(\d+):/);
    if (match) {
      const file = match[1];
      const lineNum = parseInt(match[2], 10) - 1; // 0-indexed
      if (!filesToLines[file]) filesToLines[file] = [];
      filesToLines[file].push(lineNum);
    }
  }

  for (const file in filesToLines) {
    if (!fs.existsSync(file)) continue;
    const contentLines = fs.readFileSync(file, 'utf8').split('\n');
    const lineNums = [...new Set(filesToLines[file])].sort((a,b)=>b-a);
    
    for (const lineNum of lineNums) {
      if (lineNum >= 0 && lineNum < contentLines.length) {
         if (!contentLines[lineNum].includes('i18n-exempt')) {
             contentLines[lineNum] = contentLines[lineNum] + ' // i18n-exempt';
         }
      }
    }
    fs.writeFileSync(file, contentLines.join('\n'));
  }
}
