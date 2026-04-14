---
description: Bezpečný git push s pre-push kontrolami a potvrzením
---

Pushni aktuální branch na remote s předchozí kontrolou stavu.

## Postup

### 1. Shromáždi kontext (paralelně přes Bash)
- `git branch --show-current` — aktuální branch
- `git status --short` — dirty?
- `git log --oneline @{upstream}..HEAD` — kolik commitů ahead (pokud upstream existuje)
- `git log --oneline HEAD..@{upstream}` — kolik commitů behind
- `git remote get-url origin` — kam se bude pushovat

### 2. Vyhodnoť stav

**Pokud není nic k pushi** (ahead = 0):
- Vypiš `Nic k pushnutí — branch je sync s upstream.` a skonči.

**Pokud je working tree dirty:**
- Vypiš co je dirty.
- Zeptej se přes AskUserQuestion: "Working tree není čistý. Co s tím?"
  - **Spustit /commit** — skonči tento command a doporuč uživateli `/commit`
  - **Pushnout i přes dirty** — (unstaged změny se stejně nepushovnou) pokračuj dál
  - **Zrušit** — skonči

**Pokud je TypeScript projekt** (existuje `tsconfig.json`):
- Spusť `npx tsc --noEmit` (jako `/tsc`).
- Pokud fail → AskUserQuestion: "tsc hlásí chyby. Pushnout i tak?"
  - **Pushnout i tak** — pokračuj
  - **Opravit chyby** — skonči
  - **Zrušit** — skonči

### 3. Pre-push potvrzení

Vypiš souhrn:
```
Pushuju na: <remote-url>
Branch: <branch>
Commits k pushi: <N>
  - <hash> <subject>
  - ...
```

**Pokud branch je `main` / `master`:**
- AskUserQuestion s výrazným varováním: "Pushuješ na hlavní větev. Opravdu?"
  - **Ano, pushnout na main/master** — pokračuj
  - **Zrušit** — skonči

**Jinak:**
- AskUserQuestion: "Pokračovat s push?"
  - **Push** — pokračuj
  - **Zrušit** — skonči

### 4. Provedení
- `git push` (bez `--force`, `--force-with-lease` ani podobných flagů — nikdy).
- Pokud push selže (např. non-fast-forward), report chybu a **ne**pokoušej se automaticky rebase/force.

### 5. Report
Po úspěšném pushi: `✓ Pushnuto na <remote>/<branch>: <N> commit(ů)`.

## Absolutně zakázáno

- `git push --force`, `--force-with-lease`, `-f`
- `--no-verify` (přeskakování hooks)
- Push po `git rebase -i` bez explicitní žádosti uživatele
- Push na main/master bez potvrzení
