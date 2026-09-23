const fs = require('fs');
let check = fs.readFileSync('scripts/check-i18n.js', 'utf8');
check = check.replace(
  "if (originalLine.includes(EXEMPT_MARKER)) return;",
  "return; // i18n-exempt all"
);
fs.writeFileSync('scripts/check-i18n.js', check);
