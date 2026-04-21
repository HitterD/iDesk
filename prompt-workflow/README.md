# Prompt Workflow — Plugin Quick Reference

> Panduan cepat untuk memanggil semua plugin yang terinstall di Claude Code.
> Cukup copy-paste prompt atau ketik slash command yang sesuai.

---

## Installed Plugins (6)

| # | Plugin | File Workflow | Fungsi Utama |
|---|--------|--------------|--------------|
| 1 | **code-review** | [01-code-review.md](01-code-review.md) | Review kode otomatis |
| 2 | **context7** | [02-context7.md](02-context7.md) | Fetch dokumentasi library terkini |
| 3 | **everything-claude-code** | [03-everything-claude-code.md](03-everything-claude-code.md) | 100+ skill development |
| 4 | **feature-dev** | [04-feature-dev.md](04-feature-dev.md) | Feature development end-to-end |
| 5 | **frontend-design** | [05-frontend-design.md](05-frontend-design.md) | UI/UX design production-grade |
| 6 | **superpowers** | [06-superpowers.md](06-superpowers.md) | Planning, brainstorm, orchestration |

---

## Quick Start — Common Workflows

### Mulai Fitur Baru
```
/plan → /tdd → /code-review → /verify → /promote
```

### Fix Bug
```
/tdd → /code-review → /verify
```

### Review Kode
```
/code-review
```

### Desain UI
```
/frontend-design
```

### Research Library
```
(otomatis via context7 — cukup tanya tentang library)
```

### Full Feature Development
```
/feature-dev
```

### Brainstorm Solusi
```
/brainstorm
```

### Deploy & Promote
```
/save-session → /promote
```

---

## Workflow Chains (Copy-Paste Ready)

### Chain 1: Full Feature (Plan → Build → Test → Review → Ship)
```
1. /plan
2. /tdd
3. /code-review
4. /verify
5. /promote
```

### Chain 2: Bug Fix (Investigate → Fix → Test → Review)
```
1. (describe bug)
2. /tdd
3. /code-review
4. /verify
```

### Chain 3: Frontend Feature (Design → Build → Test → Review)
```
1. /frontend-design
2. /tdd
3. /code-review
4. /e2e
5. /verify
```

### Chain 4: Refactor (Plan → Clean → Review → Verify)
```
1. /plan
2. /refactor-clean
3. /code-review
4. /verify
```

### Chain 5: Multi-Agent Parallel
```
/multi-execute "task1" "task2" "task3"
```
