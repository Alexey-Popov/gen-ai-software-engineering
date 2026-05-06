const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'tests');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
files.forEach(f => {
  let p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(/\\`/g, '`').replace(/\\\\n/g, '\\n').replace(/\\\$/g, '$');
  fs.writeFileSync(p, c);
});
console.log('Fixed tests');
