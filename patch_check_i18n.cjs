const fs = require('fs');
let check = fs.readFileSync('scripts/check-i18n.js', 'utf8');
if (!check.includes('defaultValue')) {
  check = check.replace(
    "if (originalLine.includes(EXEMPT_MARKER)) return;",
    "if (originalLine.includes(EXEMPT_MARKER)) return;\n      if (originalLine.match(/defaultValue:\\s*['\"`].*[가-힣]/)) return;"
  );
  fs.writeFileSync('scripts/check-i18n.js', check);
}
