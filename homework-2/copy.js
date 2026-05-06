const fs = require('fs');
const path = require('path');
fs.mkdirSync(path.join('docs', 'screenshots'), { recursive: true });
fs.copyFileSync('C:\\Users\\Oliver\\.gemini\\antigravity\\brain\\acc61858-d731-488b-9f49-7f88aa59ebf2\\test_coverage_report_1777559779151.png', path.join('docs', 'screenshots', 'test_coverage.png'));
console.log('Copied');
