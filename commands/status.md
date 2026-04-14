---
description: Kompaktní souhrn git + tsc stavu projektu
---

# Status — kompaktní panel

Jednorázový kompaktní report o stavu repa. Read-only, žádné modifikace.

## Postup

### 1. Shromáždi info paralelně (Bash)
- `git branch --show-current`
- `git status --short`
- `git rev-list --count @{u}..HEAD 2>/dev/null` — ahead
- `git rev-list --count HEAD..@{u} 2>/dev/null` — behind
- Pokud existuje `tsconfig.json` → `npx tsc --noEmit`

### 2. Formát výstupu — unicode panel

````
╭─ status · <název projektu> ─────────────────╮
│  branch    <branch> · ±<N> · ↑<A> ↓<B>      │
│  tsc       ✓ 0 chyb                         │
│  změny     <N> souborů (M modified, A ...)  │
│  commity   <hash> <subject>                 │
╰─────────────────────────────────────────────╯
````

**Pravidla řádků:**
- `branch` vždy. Pokud `no upstream` → `<branch> (no upstream)`. Pokud sync → `<branch> · sync`.
- `tsc` jen pokud je TS projekt. `✓ 0 chyb` / `✗ N chyb` / při neúspěchu `— (nespuštěno)`.
- `změny` jen pokud dirty. Pokud čistý, řádek vynech.
- `commity` = poslední 1 commit (hash + subject, zkrácený na šířku).

### 3. Rozšíření při chybách

**Pokud tsc failne** — pod panel přidej další rámeček:

````
╭─ ⚠ tsc · N chyb ─────────────────────────────╮
│  path/file.ts:12 — popis                     │
│  path/file.ts:42 — popis                     │
╰──────────────────────────────────────────────╯
````

Max 5 chyb. Pokud víc: `… a dalších N` jako poslední řádek uvnitř.

**Pokud je dirty** — přidej seznam:

````
╭─ změny ──────────────────────────────────────╮
│  M  src/app.ts                               │
│  A  new-file.md                              │
│  ?? untracked.txt                            │
╰──────────────────────────────────────────────╯
````

Max 5 souborů.

## Pravidla

- Read-only, žádné modifikace.
- Výstup krátký a čitelný — hlavní panel ≤6 řádků (bez rámečku).
- Žádné otázky, žádné potvrzení.
- Rámečky zarovnej — šířka všech řádků uvnitř musí být stejná.
- Česky.
- Barvy / ANSI escape kódy **nepoužívej** — nerenderují se v UI.
