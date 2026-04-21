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
    ...findFiles('./src/modules', f => f.endsWith('controller.ts')),
    ...findFiles('./src/modules', f => f.endsWith('guard.ts')),
    ...findFiles('./scripts', f => f.endsWith('.ts')),
    ...findFiles('./src', f => f.endsWith('main.ts')),
    ...findFiles('./src/modules', f => f.endsWith('action-executor.service.ts')),
    ...findFiles('./src/modules', f => f.endsWith('health.service.ts'))
];

for (const f of targetFiles) {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;

    // Controllers
    content = content.replace(/@Request\(\)\s+req,/g, '@Request() req: any,');
    content = content.replace(/@Request\(\)\s+req\)/g, '@Request() req: any)');
    content = content.replace(/@Req\(\)\s+req,/g, '@Req() req: any,');
    content = content.replace(/@Req\(\)\s+req\)/g, '@Req() req: any)');

    // Callbacks
    content = content.replace(/columns\.map\(c =>/g, 'columns.map((c: any) =>');
    content = content.replace(/columns\.some\(c =>/g, 'columns.some((c: any) =>');
    content = content.replace(/columns\.find\(c =>/g, 'columns.find((c: any) =>');
    content = content.replace(/filter:\s*\(/g, 'filter: ('); // normalizer
    content = content.replace(/filter:\s*\(\s*req,\s*res\)/g, 'filter: (req: any, res: any)');
    content = content.replace(/handleRequest\(err,\s*user,\s*info\)/g, 'handleRequest(err: any, user: any, info: any)');
    content = content.replace(/\{ id:\s*\(id\)\s*=>/g, '{ id: (id: any) =>');
    content = content.replace(/filter\(l =>/g, 'filter((l: any) =>');

    if (content !== original) {
        fs.writeFileSync(f, content);
        console.log('Fixed:', f);
    }
}
