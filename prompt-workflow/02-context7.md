# Plugin: context7

> **Source:** `context7@claude-plugins-official`
> **Fungsi:** Fetch dokumentasi library/framework terkini via MCP.

---

## Cara Kerja

Context7 **otomatis aktif** saat kamu bertanya tentang library, framework, atau API.
Tidak perlu slash command — cukup tanya.

---

## Trigger Otomatis

Context7 akan auto-fetch docs saat kamu:
- Tanya syntax/API library tertentu
- Minta contoh penggunaan framework
- Debug masalah yang terkait library
- Setup/konfigurasi tool atau SDK

---

## Prompt Templates

### Template 1: Cari Docs Library
```
Bagaimana cara pakai [nama library] versi [versi]?
Contoh: "Bagaimana cara pakai Prisma versi 5 untuk relasi many-to-many?"
```

### Template 2: Migration Guide
```
Saya upgrade [library] dari v[X] ke v[Y]. Apa yang berubah dan bagaimana migrasinya?
Contoh: "Saya upgrade Next.js dari v13 ke v14. Apa breaking changes-nya?"
```

### Template 3: Troubleshoot Error
```
Saya dapat error ini saat pakai [library]:
[paste error]
Tolong cek docs terbaru untuk solusinya.
```

### Template 4: Setup dari Nol
```
Setup [library/framework] untuk project TypeScript.
Contoh: "Setup Tailwind CSS v4 untuk project Next.js ini"
```

### Template 5: Bandingkan Approach
```
Untuk [use case], lebih baik pakai [lib A] atau [lib B]?
Cek docs terbaru keduanya.
```

---

## Tools MCP Yang Dipakai

| Tool | Fungsi |
|------|--------|
| `resolve-library-id` | Cari ID library di database Context7 |
| `query-docs` | Fetch dokumentasi berdasarkan query |

---

## Tips
- Context7 paling berguna untuk library yang sering berubah API-nya
- Selalu sebutkan **versi** jika tahu, agar docs yang di-fetch akurat
- Max 3 panggilan per pertanyaan — gunakan hasil terbaik
