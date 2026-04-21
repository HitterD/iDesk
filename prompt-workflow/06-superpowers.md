# Plugin: superpowers

> **Source:** `superpowers@claude-plugins-official`
> **Fungsi:** Planning, brainstorming, orchestration, dan meta-skills.

---

## Slash Commands

| Command | Fungsi |
|---------|--------|
| `/brainstorm` | Brainstorm solusi dari berbagai sudut pandang |
| `/write-plan` | Tulis implementation plan terstruktur |
| `/execute-plan` | Eksekusi plan yang sudah dibuat |

---

## Skill Workflows

### 1. Brainstorming
```
/brainstorm
```

Memulai sesi brainstorm multi-perspektif:
- Generasi banyak ide
- Evaluasi pro/kontra tiap opsi
- Rekomendasi terbaik berdasarkan context

### 2. Write Plan
```
/write-plan
```

Buat plan terstruktur dengan:
- Breakdown tasks
- Dependencies
- Risk assessment
- Milestones

### 3. Execute Plan
```
/execute-plan
```

Eksekusi plan yang sudah dibuat secara step-by-step:
- Track progress per step
- Verify setiap step sebelum lanjut
- Report hasil tiap milestone

---

## Advanced Superpowers Workflows

### Code Review (Requesting)
```
Gunakan superpowers code-review agent untuk review implementasi saya.
Review terhadap plan original dan coding standards.
```

### Parallel Agents
```
Dispatch parallel agents:
1. Agent 1: [task]
2. Agent 2: [task]
3. Agent 3: [task]
```

### Systematic Debugging
```
Debug masalah ini secara sistematis:
- Symptom: [apa yang terjadi]
- Expected: [apa yang seharusnya]
- Already tried: [apa yang sudah dicoba]
```

### Git Worktrees
```
Gunakan git worktree untuk mengerjakan [fitur] secara isolated dari main branch.
```

### Test-Driven Development
```
Implementasi [fitur] dengan TDD approach melalui superpowers workflow.
```

### Verification Before Completion
```
Verifikasi semua perubahan sebelum saya mark sebagai complete:
- Build passes?
- Tests pass?
- No security issues?
- Matches original plan?
```

### Subagent-Driven Development
```
Gunakan subagent-driven development:
- Subagent 1: Research & explore
- Subagent 2: Implement
- Subagent 3: Review & test
```

---

## Prompt Templates

### Template 1: Brainstorm Arsitektur
```
/brainstorm

Bagaimana cara terbaik mengimplementasi [fitur/sistem]?

Konteks:
- Tech stack: [stack]
- Scale: [ukuran/users]
- Constraints: [batasan]

Pertimbangkan: performance, maintainability, security, cost.
```

### Template 2: Plan Sprint
```
/write-plan

Plan implementasi untuk sprint berikutnya:

Goals:
1. [goal 1]
2. [goal 2]
3. [goal 3]

Timeline: [durasi]
Team: [siapa mengerjakan apa]
Dependencies: [external dependencies]
```

### Template 3: Execute dengan Tracking
```
/execute-plan

Eksekusi plan yang sudah kita buat.
Untuk setiap step:
1. Verify pre-conditions
2. Execute
3. Test
4. Report status
5. Proceed atau escalate
```

### Template 4: Multi-Perspective Analysis
```
/brainstorm

Analisis [masalah/keputusan] dari perspektif:
- Senior engineer (technical quality)
- Security expert (vulnerabilities)
- Product manager (user impact)
- DevOps (operational concerns)

Berikan rekomendasi final yang balanced.
```

---

## Tips
- `/brainstorm` cocok untuk keputusan arsitektur besar
- `/write-plan` cocok sebelum mulai fitur kompleks
- `/execute-plan` cocok setelah plan disetujui
- Superpowers paling kuat saat di-chain: brainstorm → plan → execute → verify
