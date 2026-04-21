# Plugin: code-review

> **Source:** `code-review@claude-plugins-official`
> **Fungsi:** Review kode untuk quality, security, dan maintainability.

---

## Slash Commands

| Command | Fungsi |
|---------|--------|
| `/code-review` | Review kode yang baru ditulis/dimodifikasi |

---

## Cara Pakai

### Review File Tertentu
```
/code-review

Lalu sebutkan file yang ingin di-review:
"Review file src/services/auth.ts"
```

### Review Semua Perubahan
```
/code-review

"Review semua perubahan yang baru saya buat"
```

### Review dengan Fokus Tertentu
```
/code-review

"Review fokus pada security dan error handling di file api/routes.ts"
```

---

## Prompt Templates

### Template 1: Review Setelah Coding
```
Review kode yang baru saya tulis. Fokus pada:
- Security vulnerabilities
- Error handling
- Performance issues
- Code quality
```

### Template 2: Review Sebelum Commit
```
Saya mau commit. Review semua perubahan saya dan flag masalah CRITICAL atau HIGH sebelum saya commit.
```

### Template 3: Review Pull Request
```
Review PR ini: [URL atau deskripsi perubahan]
Bandingkan dengan best practices dan codebase conventions.
```

---

## Output Yang Diharapkan

Code reviewer akan memberikan:
- **CRITICAL** — Harus diperbaiki sebelum commit
- **HIGH** — Sangat disarankan diperbaiki
- **MEDIUM** — Perbaiki jika memungkinkan
- **LOW** — Nice to have, opsional
