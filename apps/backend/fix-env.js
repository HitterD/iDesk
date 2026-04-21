const fs = require('fs');
const path = require('path');

function findFiles(dir, filter, res = []) {
  if (!fs.existsSync(dir)) return res;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fullPath = path.join(dir, f);
    if (fs.statSync(fullPath).isDirectory()) {
      findFiles(fullPath, filter, res);
    } else if (filter(fullPath)) {
      res.push(fullPath);
    }
  }
  return res;
}

const targetFiles = [
    './src/data-source.ts',
    './src/app.module.ts',
    './src/modules/knowledge-base/seeds/run-seed.ts',
    './src/seeds/run-seed.ts'
];

for (const f of targetFiles) {
    if(!fs.existsSync(f)) continue;

    let content = fs.readFileSync(f, 'utf8');
    let original = content;

    content = content.replace(/parseInt\(process\.env\.DB_PORT,\s*10\)\s*\|\|\s*5432/g, "parseInt(process.env.DB_PORT || '5432', 10)");
    content = content.replace(/parseInt\(process\.env\.DB_POOL_MAX,\s*10\)\s*\|\|\s*20/g, "parseInt(process.env.DB_POOL_MAX || '20', 10)");
    content = content.replace(/parseInt\(process\.env\.DB_POOL_MIN,\s*10\)\s*\|\|\s*5/g, "parseInt(process.env.DB_POOL_MIN || '5', 10)");
    content = content.replace(/parseInt\(process\.env\.SMTP_PORT,\s*10\)\s*\|\|\s*587/g, "parseInt(process.env.SMTP_PORT || '587', 10)");

    if (content !== original) {
        fs.writeFileSync(f, content);
        console.log('Fixed:', f);
    }
}
