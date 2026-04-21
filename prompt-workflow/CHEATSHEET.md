# Cheat Sheet — Semua Slash Commands

> Copy-paste command yang kamu butuhkan. Satu halaman, semua plugin.

---

## Most Used (Top 10)

| Command | Plugin | Fungsi |
|---------|--------|--------|
| `/plan` | everything-claude-code | Buat implementation plan |
| `/tdd` | everything-claude-code | TDD workflow |
| `/code-review` | code-review | Review kode |
| `/verify` | everything-claude-code | Verifikasi sebelum selesai |
| `/frontend-design` | frontend-design | Desain UI production-grade |
| `/feature-dev` | feature-dev | Feature development end-to-end |
| `/brainstorm` | superpowers | Brainstorm multi-perspektif |
| `/build-fix` | everything-claude-code | Fix build errors |
| `/e2e` | everything-claude-code | End-to-end testing |
| `/promote` | everything-claude-code | Promote branch / create PR |

---

## Full Command List (A-Z)

### A
| Command | Fungsi |
|---------|--------|
| `/aside` | Side conversation tanpa ganggu konteks |

### B
| Command | Fungsi |
|---------|--------|
| `/brainstorm` | Brainstorm solusi multi-perspektif |
| `/build-fix` | Fix TypeScript/JS build errors |

### C
| Command | Fungsi |
|---------|--------|
| `/checkpoint` | Simpan checkpoint progress |
| `/claw` | Claw mode |
| `/code-review` | Review kode |
| `/configure-ecc` | Konfigurasi everything-claude-code |
| `/context-budget` | Manage context window budget |
| `/cpp-build` | Fix C++/CMake build errors |
| `/cpp-review` | Review kode C++ |
| `/cpp-test` | Testing C++ |

### D
| Command | Fungsi |
|---------|--------|
| `/devfleet` | Multi-agent fleet development |
| `/docs` | Update dokumentasi |

### E
| Command | Fungsi |
|---------|--------|
| `/e2e` | End-to-end testing |
| `/evolve` | Evolve skill/config |
| `/execute-plan` | Eksekusi plan yang sudah dibuat |

### F
| Command | Fungsi |
|---------|--------|
| `/feature-dev` | Feature development end-to-end |
| `/frontend-design` | Desain UI production-grade |

### G
| Command | Fungsi |
|---------|--------|
| `/go-build` | Fix Go build errors |
| `/go-review` | Review kode Go |
| `/go-test` | Testing Go |
| `/gradle-build` | Fix Gradle build errors |

### H
| Command | Fungsi |
|---------|--------|
| `/harness-audit` | Audit agent harness config |

### K
| Command | Fungsi |
|---------|--------|
| `/kotlin-build` | Fix Kotlin build errors |
| `/kotlin-review` | Review kode Kotlin |
| `/kotlin-test` | Testing Kotlin |

### L
| Command | Fungsi |
|---------|--------|
| `/learn` | Learn dari codebase |
| `/loop-start` | Mulai autonomous loop |
| `/loop-status` | Cek status loop |

### M
| Command | Fungsi |
|---------|--------|
| `/model-route` | Route ke model optimal |
| `/multi-backend` | Multi-komponen backend paralel |
| `/multi-execute` | Jalankan multiple tasks paralel |
| `/multi-frontend` | Multi-komponen frontend paralel |
| `/multi-plan` | Plan multi-komponen paralel |
| `/multi-workflow` | Multi-step workflow |

### O
| Command | Fungsi |
|---------|--------|
| `/orchestrate` | Orchestrate multi-agent workflow |

### P
| Command | Fungsi |
|---------|--------|
| `/plan` | Buat implementation plan |
| `/pm2` | Manage PM2 processes |
| `/projects` | Lihat projects |
| `/promote` | Promote branch / create PR |
| `/prompt-optimize` | Optimasi prompt |
| `/prune` | Prune unused dependencies |
| `/python-review` | Review kode Python |

### Q
| Command | Fungsi |
|---------|--------|
| `/quality-gate` | Quality gate check |

### R
| Command | Fungsi |
|---------|--------|
| `/refactor-clean` | Bersihkan dead code |
| `/resume-session` | Resume session sebelumnya |
| `/rules-distill` | Distill rules jadi compact |
| `/rust-build` | Fix Rust build errors |
| `/rust-review` | Review kode Rust |
| `/rust-test` | Testing Rust |

### S
| Command | Fungsi |
|---------|--------|
| `/save-session` | Simpan session state |
| `/sessions` | Lihat daftar sessions |
| `/skill-create` | Buat skill baru |
| `/skill-health` | Cek kesehatan skill |

### T
| Command | Fungsi |
|---------|--------|
| `/tdd` | TDD workflow |
| `/test-coverage` | Cek test coverage |

### U
| Command | Fungsi |
|---------|--------|
| `/update-codemaps` | Update code maps |
| `/update-docs` | Update docs |

### V
| Command | Fungsi |
|---------|--------|
| `/verify` | Verifikasi sebelum completion |

### W
| Command | Fungsi |
|---------|--------|
| `/write-plan` | Tulis plan terstruktur |

---

## Workflow Recipes

### Recipe: Fitur Baru (Full)
```
/plan → /tdd → /code-review → /verify → /promote
```

### Recipe: Bug Fix (Quick)
```
/tdd → /code-review → /verify
```

### Recipe: UI Component
```
/frontend-design → /code-review → /e2e
```

### Recipe: Refactor
```
/plan → /refactor-clean → /code-review → /verify
```

### Recipe: Research → Build
```
/brainstorm → /write-plan → /execute-plan → /verify
```

### Recipe: Multi-Agent Sprint
```
/multi-plan → /multi-execute → /verify → /promote
```
