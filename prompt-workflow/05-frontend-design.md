# Plugin: frontend-design

> **Source:** `frontend-design@claude-plugins-official`
> **Fungsi:** Buat UI/UX yang distinctive dan production-grade — bukan template generik.

---

## Slash Commands

| Command | Fungsi |
|---------|--------|
| `/frontend-design` | Mulai frontend design workflow |

---

## Design Thinking Framework

Sebelum coding, skill ini memaksa untuk menjawab:

| Aspek | Pertanyaan |
|-------|-----------|
| **Purpose** | Masalah apa yang dipecahkan? Siapa usernya? |
| **Tone** | Estetik apa? (minimalis, maximalist, retro, futuristik, dll) |
| **Constraints** | Framework, performa, aksesibilitas |
| **Differentiation** | Apa yang bikin desain ini unforgettable? |

---

## Aesthetic Options

Pilih satu arah estetik:

| Style | Deskripsi |
|-------|----------|
| Brutally Minimal | Sangat bersih, hanya esensi |
| Maximalist Chaos | Ramai, vibrant, penuh detail |
| Retro-Futuristic | Campuran vintage + futur |
| Organic/Natural | Bentuk organik, warna alam |
| Luxury/Refined | Elegan, premium feel |
| Playful/Toy-like | Fun, colorful, kasual |
| Editorial/Magazine | Layout majalah, tipografi kuat |
| Brutalist/Raw | Raw, unpolished, industrial |
| Art Deco/Geometric | Pattern geometris, gold accents |
| Soft/Pastel | Lembut, rounded, pastel |
| Industrial/Utilitarian | Fungsional, no-nonsense |

---

## Prompt Templates

### Template 1: Komponen Spesifik
```
/frontend-design

Buat [jenis komponen] untuk [konteks aplikasi].

Spesifikasi:
- Framework: [React/Vue/HTML]
- Tone: [pilih dari aesthetic options]
- Dark/Light: [preferensi]
- Interaksi: [hover effects, animations, dll]
- Data yang ditampilkan: [deskripsi]
```

### Template 2: Halaman Penuh
```
/frontend-design

Desain halaman [nama halaman] untuk aplikasi [nama app].

Sections:
- [section 1 — deskripsi]
- [section 2 — deskripsi]
- [section 3 — deskripsi]

Target audience: [deskripsi user]
Tone: [aesthetic choice]
Must have: [fitur wajib]
```

### Template 3: Landing Page
```
/frontend-design

Buat landing page untuk [produk/service].

Sections yang dibutuhkan:
- Hero section dengan CTA
- Features/benefits
- Social proof/testimonials
- Pricing (opsional)
- Footer

Brand colors: [warna jika ada]
Tone: [aesthetic choice]
Framework: [React/HTML]
```

### Template 4: Dashboard
```
/frontend-design

Desain dashboard [nama] dengan:
- Sidebar navigation
- [widget 1 — deskripsi]
- [widget 2 — deskripsi]
- [chart/graph — tipe dan data]

User role: [admin/operator/viewer]
Data density: [sparse/moderate/dense]
Tone: [aesthetic choice]
```

### Template 5: Form/Input
```
/frontend-design

Buat form [nama form] dengan fields:
- [field 1: type, validation]
- [field 2: type, validation]
- [field 3: type, validation]

Multi-step: [ya/tidak]
Validation: [realtime/on-submit]
Tone: [aesthetic choice]
```

---

## Yang DILARANG oleh Plugin Ini

- Font generik: Inter, Roboto, Arial, Space Grotesk
- Purple gradient on white (cliche AI design)
- Cookie-cutter layouts
- Template-style components tanpa karakter

---

## Tips
- Semakin detail konteks yang diberikan, semakin distinctive hasilnya
- Selalu sebutkan framework target (React, Vue, HTML)
- Sebutkan tone/aesthetic agar tidak random
- Plugin ini menghasilkan **kode production-ready**, bukan mockup
