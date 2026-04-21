const fs = require('fs');
const path = require('path');

// Read the merged markdown
const mdContent = fs.readFileSync(path.join(__dirname, 'iDesk_Blueprint.md'), 'utf8');

// Simple markdown-to-HTML converter for blueprint
function mdToHtml(md) {
    let html = md
        // H1
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // H2
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        // H3
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        // H4
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Horizontal rule
        .replace(/^---$/gm, '<hr>')
        // Blank lines
        .replace(/\n\n/g, '\n</p>\n<p>');

    // Convert tables
    html = html.replace(/(\|.+\|\n)+/g, (tableBlock) => {
        const rows = tableBlock.trim().split('\n');
        let tableHtml = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;margin:12px 0;">';
        rows.forEach((row, i) => {
            if (row.match(/^\|[-| ]+\|$/)) return; // skip separator
            const cells = row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            const tag = i === 0 ? 'th' : 'td';
            const style = i === 0 ? ' style="background:#1e40af;color:#fff;"' : '';
            tableHtml += '<tr>' + cells.map(c => `<${tag}${style}>${c.trim()}</${tag}>`).join('') + '</tr>';
        });
        tableHtml += '</table>';
        return tableHtml;
    });

    // Convert code blocks
    html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Convert list items
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

    // Convert numbered list
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    return html;
}

const htmlBody = mdToHtml(mdContent);

const fullHtml = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>iDesk Blueprint — Enterprise IT Helpdesk System</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1e293b;
    background: #fff;
    padding: 40px;
    max-width: 1100px;
    margin: 0 auto;
  }
  h1 {
    font-size: 26pt;
    color: #1e3a8a;
    border-bottom: 4px solid #2563eb;
    padding-bottom: 12px;
    margin: 40px 0 20px;
    page-break-before: always;
  }
  h1:first-of-type { page-break-before: avoid; }
  h2 {
    font-size: 16pt;
    color: #1e40af;
    border-left: 5px solid #2563eb;
    padding-left: 12px;
    margin: 30px 0 14px;
  }
  h3 {
    font-size: 13pt;
    color: #1e3a8a;
    margin: 22px 0 10px;
  }
  h4 {
    font-size: 11pt;
    color: #374151;
    font-weight: 700;
    margin: 16px 0 8px;
  }
  p { margin: 8px 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 10pt;
  }
  th {
    background: #1e40af;
    color: #fff;
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
  }
  td {
    border: 1px solid #cbd5e1;
    padding: 6px 10px;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #f1f5f9; }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 14px 16px;
    border-radius: 8px;
    font-size: 9pt;
    overflow-x: auto;
    margin: 12px 0;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  code {
    font-family: 'Consolas', 'Courier New', monospace;
    background: #e2e8f0;
    color: #dc2626;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 10pt;
  }
  pre code {
    background: transparent;
    color: #e2e8f0;
    padding: 0;
  }
  ul, ol { margin: 8px 0 8px 24px; }
  li { margin: 4px 0; }
  hr {
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 30px 0;
  }
  strong { color: #1e293b; }
  .cover {
    text-align: center;
    padding: 80px 20px;
    border-bottom: 4px solid #2563eb;
    margin-bottom: 40px;
  }
  .cover h1 {
    font-size: 36pt;
    border: none;
    page-break-before: avoid;
    color: #1e3a8a;
  }
  .cover .subtitle {
    font-size: 16pt;
    color: #2563eb;
    margin: 10px 0 30px;
  }
  .toc { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px 30px; margin: 20px 0; }
  @media print {
    body { padding: 20px; }
    h1 { page-break-before: always; }
    h1:first-of-type { page-break-before: avoid; }
    pre { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="cover">
  <h1>iDesk</h1>
  <div class="subtitle">Enterprise IT Helpdesk System</div>
  <div class="subtitle" style="font-size:13pt;color:#374151;">Blueprint Teknis Lengkap — End to End</div>
  <br>
  <table style="max-width:500px;margin:0 auto;">
    <tr><td><strong>Versi Dokumen</strong></td><td>1.0</td></tr>
    <tr><td><strong>Tanggal</strong></td><td>24 Februari 2026</td></tr>
    <tr><td><strong>Status</strong></td><td>Production Active</td></tr>
    <tr><td><strong>Total Modul Backend</strong></td><td>28 Modules</td></tr>
    <tr><td><strong>Total Fitur Frontend</strong></td><td>17 Feature Areas</td></tr>
    <tr><td><strong>Total Entitas Database</strong></td><td>40+ Entities</td></tr>
  </table>
</div>
${htmlBody}
</body>
</html>`;

// Write HTML file
fs.writeFileSync(path.join(__dirname, 'iDesk_Blueprint.html'), fullHtml, 'utf8');
console.log('HTML file generated: iDesk_Blueprint.html');
console.log('To convert to PDF: open iDesk_Blueprint.html in browser and Print -> Save as PDF');
