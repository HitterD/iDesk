import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiBaseUrl, type IntegrationApp } from './api';

type Lang = 'json' | 'node' | 'csharp' | 'php';
const LANGS: Array<{ value: Lang; label: string }> = [
    { value: 'json', label: 'Isi tiket' },
    { value: 'node', label: 'Node.js' },
    { value: 'csharp', label: 'C#' },
    { value: 'php', label: 'PHP' },
];

/** Example body for this app's first module; NIKs are placeholders the developer replaces. */
function ticketJson(app: IntegrationApp): string {
    const module = app.modules[0] ?? 'web-developer';
    return JSON.stringify({
        externalRef: `${app.clientId.toUpperCase()}-2026-000123`,
        module,
        ...(module === 'it-support' ? { category: 'SOFTWARE' } : {}),
        priority: 'HIGH',
        title: 'Approval transaksi lompat ke kasir',
        description: 'Approve dari saya seharusnya masuk ke Manager Finance, tapi lompat ke Kasir.',
        requester: { nik: '00061001' },
        submittedBy: { nik: '00061002' },
    }, null, 2);
}

function snippet(lang: Lang, app: IntegrationApp): string {
    const base = apiBaseUrl();
    switch (lang) {
        case 'json': return ticketJson(app);
        case 'node': return `import { createHmac } from 'crypto';

const BASE = '${base}';
const CLIENT_ID = '${app.clientId}';
const SECRET = process.env.IDESK_SECRET; // simpan di konfigurasi server

export async function idesk(method, path, payload) {
  const body = payload ? JSON.stringify(payload) : '';
  const ts = String(Date.now());
  const signature = createHmac('sha256', SECRET).update(\`\${ts}.\${body}\`).digest('hex');
  const res = await fetch(BASE + path, {
    method, body: body || undefined,
    headers: { 'Content-Type': 'application/json', 'x-idesk-client-id': CLIENT_ID,
               'x-idesk-timestamp': ts, 'x-idesk-signature': signature },
  });
  return res.json();
}

const ticket = await idesk('POST', '/tickets', { /* isi tiket */ });`;
        case 'csharp': return `using System.Security.Cryptography; using System.Text;

var body = JsonSerializer.Serialize(ticket);           // tanda tangani teks yang sama persis
var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(cfg["IDesk:Secret"]!));
var sig = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{ts}.{body}"))).ToLowerInvariant();

var req = new HttpRequestMessage(HttpMethod.Post, "${base}/tickets")
    { Content = new StringContent(body, Encoding.UTF8, "application/json") };
req.Headers.Add("x-idesk-client-id", "${app.clientId}");
req.Headers.Add("x-idesk-timestamp", ts);
req.Headers.Add("x-idesk-signature", sig);
var res = await http.SendAsync(req);`;
        case 'php': return `$body = json_encode($ticket, JSON_UNESCAPED_UNICODE);  // tanda tangani teks yang sama persis
$ts = (string) round(microtime(true) * 1000);
$sig = hash_hmac('sha256', $ts . '.' . $body, getenv('IDESK_SECRET'));

$ch = curl_init('${base}/tickets');
curl_setopt_array($ch, [
  CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-idesk-client-id: ${app.clientId}',
                         "x-idesk-timestamp: $ts", "x-idesk-signature: $sig"],
]);
$ticket = json_decode(curl_exec($ch), true);`;
    }
}

/** Ready-to-copy example for one app: the request body and request signing in common languages. */
export const QuickStart: React.FC<{ app: IntegrationApp }> = ({ app }) => {
    const [lang, setLang] = useState<Lang>('json');
    const [copied, setCopied] = useState(false);
    const code = snippet(lang, app);
    const copy = async () => {
        await navigator.clipboard.writeText(code).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <section className="iapp-guide" aria-label={`Panduan cepat ${app.name}`}>
            <ol className="iapp-steps">
                <li><b>Tanda tangani setiap request</b> dengan HMAC-SHA256 dari <code>timestamp.body</code> memakai secret aplikasi.</li>
                <li><b>POST /tickets</b> dengan <code>requester.nik</code> = NIK HRIS pemilik tiket. Jika dikirim orang lain (mis. admin divisi), isi <code>submittedBy.nik</code>.</li>
                <li><b>Simpan <code>ticketNumber</code></b>, lalu pantau lewat <code>GET /tickets/&#123;ticketNumber&#125;</code>{app.webhookUrl ? ' atau webhook' : ''}.</li>
            </ol>
            <div className="iapp-code">
                <div className="iapp-code-tabs" role="tablist" aria-label="Contoh">
                    {LANGS.map((l) => (
                        <button key={l.value} type="button" role="tab" aria-selected={lang === l.value}
                            className={cn(lang === l.value && 'is-on')} onClick={() => setLang(l.value)}>{l.label}</button>
                    ))}
                    <button type="button" className="iapp-copy" onClick={copy} aria-label="Salin contoh">
                        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? 'Tersalin' : 'Salin'}
                    </button>
                </div>
                <pre><code>{code}</code></pre>
            </div>
            <p className="iapp-muted">Panduan lengkap (semua endpoint, kode error, webhook): <code>docs/integrations/aplikasi-terhubung-api.md</code></p>
        </section>
    );
};
