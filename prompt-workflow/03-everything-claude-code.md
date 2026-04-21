# Plugin: everything-claude-code

> **Source:** `everything-claude-code@everything-claude-code`
> **Fungsi:** 100+ skill untuk development, testing, review, deployment, dan lebih.

---

## Skill Categories

### Planning & Architecture
| Command | Fungsi |
|---------|--------|
| `/plan` | Buat implementation plan untuk fitur/refactor |
| `/multi-plan` | Plan multi-komponen secara paralel |
| `/orchestrate` | Orchestrate multi-agent workflow |

### Coding & Build
| Command | Fungsi |
|---------|--------|
| `/tdd` | Test-Driven Development workflow |
| `/build-fix` | Fix build errors otomatis |
| `/refactor-clean` | Bersihkan dead code dan refactor |
| `/multi-execute` | Jalankan multiple task paralel |
| `/multi-frontend` | Develop frontend multi-komponen |
| `/multi-backend` | Develop backend multi-komponen |

### Code Review (Per Bahasa)
| Command | Fungsi |
|---------|--------|
| `/code-review` | Review umum |
| `/python-review` | Review kode Python |
| `/go-review` | Review kode Go |
| `/rust-review` | Review kode Rust |
| `/kotlin-review` | Review kode Kotlin |
| `/cpp-review` | Review kode C++ |

### Build Error Fix (Per Bahasa)
| Command | Fungsi |
|---------|--------|
| `/build-fix` | Fix TypeScript/JS build errors |
| `/go-build` | Fix Go build errors |
| `/rust-build` | Fix Rust build errors |
| `/kotlin-build` | Fix Kotlin/Gradle errors |
| `/cpp-build` | Fix C++/CMake errors |
| `/gradle-build` | Fix Gradle errors |

### Testing
| Command | Fungsi |
|---------|--------|
| `/tdd` | TDD workflow (write test first) |
| `/e2e` | End-to-end testing |
| `/test-coverage` | Cek test coverage |
| `/go-test` | Go testing |
| `/rust-test` | Rust testing |
| `/kotlin-test` | Kotlin testing |
| `/cpp-test` | C++ testing |

### Documentation
| Command | Fungsi |
|---------|--------|
| `/docs` | Update dokumentasi |
| `/update-docs` | Update docs berdasarkan perubahan kode |
| `/update-codemaps` | Update code maps |

### Session Management
| Command | Fungsi |
|---------|--------|
| `/save-session` | Simpan session state |
| `/resume-session` | Resume session sebelumnya |
| `/sessions` | Lihat daftar session |

### Deployment & Promotion
| Command | Fungsi |
|---------|--------|
| `/promote` | Promote branch/create PR |
| `/pm2` | Manage PM2 processes |

### Quality & Verification
| Command | Fungsi |
|---------|--------|
| `/verify` | Verifikasi sebelum selesai |
| `/quality-gate` | Quality gate check |
| `/prune` | Prune unused dependencies |

### Advanced & Meta
| Command | Fungsi |
|---------|--------|
| `/evolve` | Evolve skill/config |
| `/learn` | Learn dari codebase |
| `/configure-ecc` | Configure everything-claude-code |
| `/skill-create` | Buat skill baru |
| `/skill-health` | Cek kesehatan skill |
| `/prompt-optimize` | Optimasi prompt |
| `/rules-distill` | Distill rules |
| `/context-budget` | Manage context budget |
| `/harness-audit` | Audit agent harness |

### Loop & Automation
| Command | Fungsi |
|---------|--------|
| `/loop-start` | Mulai autonomous loop |
| `/loop-status` | Cek status loop |

### Specialized Skills
| Command | Fungsi |
|---------|--------|
| `/aside` | Side conversation tanpa mengganggu konteks |
| `/claw` | Claude Code Claw mode |
| `/devfleet` | Multi-agent fleet |
| `/model-route` | Route ke model optimal |
| `/multi-workflow` | Multi-step workflow |
| `/checkpoint` | Checkpoint progress |

---

## Prompt Templates

### Template 1: Plan Fitur Baru
```
/plan

Saya ingin menambahkan fitur [deskripsi fitur].
Requirements:
- [requirement 1]
- [requirement 2]
Tech stack: [stack]
```

### Template 2: TDD Workflow
```
/tdd

Implementasi [fitur/fix] dengan TDD:
- Expected behavior: [deskripsi]
- Edge cases: [list]
```

### Template 3: Multi-Execute Paralel
```
/multi-execute

Task 1: Review security di auth module
Task 2: Fix build error di frontend
Task 3: Update docs untuk API changes
```

### Template 4: Full Verify
```
/verify

Verifikasi semua perubahan saya:
- Build berhasil?
- Tests pass?
- Security OK?
- No regressions?
```

### Template 5: Refactor & Clean
```
/refactor-clean

Bersihkan dead code dan duplikasi di [folder/file].
Jangan ubah behavior — hanya cleanup.
```
