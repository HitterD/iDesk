# Plugin: feature-dev

> **Source:** `feature-dev@claude-plugins-official`
> **Fungsi:** Feature development end-to-end — dari explorasi sampai review.

---

## Slash Commands

| Command | Fungsi |
|---------|--------|
| `/feature-dev` | Mulai guided feature development |

---

## Workflow Stages

feature-dev menggunakan 3 sub-agent secara berurutan:

### Stage 1: Code Explorer
- Analisis codebase yang ada
- Trace execution paths
- Map arsitektur layers
- Pahami patterns dan abstraksi
- Dokumentasi dependencies

### Stage 2: Code Architect
- Desain arsitektur fitur berdasarkan explorasi
- Blueprint implementasi: file apa yang dibuat/dimodifikasi
- Component designs dan data flows
- Build sequence

### Stage 3: Code Reviewer
- Review kode yang dihasilkan
- Cek bugs, logic errors, security
- Validasi adherence ke project conventions
- Confidence-based filtering (hanya report high-priority issues)

---

## Prompt Templates

### Template 1: Fitur Baru dari Nol
```
/feature-dev

Saya ingin menambahkan fitur [nama fitur].

Deskripsi:
[jelaskan apa yang fitur ini lakukan]

User story:
Sebagai [role], saya ingin [action] agar [benefit].

Constraints:
- [teknologi/library yang harus dipakai]
- [batasan performa]
- [kompatibilitas]
```

### Template 2: Extend Fitur yang Ada
```
/feature-dev

Extend fitur [nama fitur yang ada] dengan:
- [tambahan 1]
- [tambahan 2]

File utama saat ini: [path ke file]
Jangan breaking change terhadap behavior existing.
```

### Template 3: Integrasi dengan Service Lain
```
/feature-dev

Integrasikan [service A] dengan [service B].

Flow yang diinginkan:
1. [step 1]
2. [step 2]
3. [step 3]

API endpoint yang tersedia: [list endpoints]
```

### Template 4: Quick Feature
```
/feature-dev

Tambahkan [fitur sederhana] ke [komponen/halaman].
Ikuti pattern yang sudah ada di codebase.
```

---

## Tips
- feature-dev otomatis explore codebase dulu sebelum suggest implementasi
- Berikan context sebanyak mungkin agar architect agent bisa membuat blueprint yang akurat
- Cocok untuk fitur medium-to-large yang melibatkan multiple files
- Untuk fitur kecil (1-2 file), cukup langsung coding + `/code-review`
